/**
 * Generates SleepSync.shortcut — an iOS Shortcut that reads last night's sleep
 * from Apple Health and POSTs it to /api/sleep/apple-health.
 *
 *   npm run shortcut -- https://your-app.vercel.app     (deployed)
 *   npm run shortcut                                    (local: uses your LAN IP, port 8000)
 *
 * AirDrop or email the file to your iPhone and tap "Add Shortcut".
 */
import bplist from "bplist-creator";
import { networkInterfaces } from "node:os";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Dict = Record<string, unknown>;

// ── helpers ──────────────────────────────────────────────────────────────────

/** Reference to a named Shortcuts variable. */
const variable = (name: string): Dict => ({
  Value: { Type: "Variable", VariableName: name },
  WFSerializationType: "WFTokenAttachmentParameterState",
});

const action = (id: string, params: Dict = {}): Dict => ({
  WFWorkflowActionIdentifier: `is.workflow.actions.${id}`,
  WFWorkflowActionParameters: params,
});

const setVar = (name: string) => action("setvariable", { WFVariableName: name });
const getVar = (name: string) => action("getvariable", { WFVariable: variable(name) });

/** Query Sleep Analysis samples since the `From` variable. Category: 3=Core/Light 4=Deep 5=REM, none=all. */
const healthQuery = (category?: number) =>
  action("queryhealthrecords", {
    WFHealthRecordType: "Sleep Analysis",
    WFHealthStartDate: variable("From"),
    WFHealthDocumentSortOrder: "Ascending",
    ...(category !== undefined ? { WFHealthCategoryValue: category } : {}),
  });

const sumDuration = () => action("statistics", { WFStatisticsOperation: "Sum", WFStatisticsProperty: "Duration" });

const mathAdd = (name: string) => action("math", { WFMathOperation: "+", WFMathOperand: variable(name) });

const mathDivide = (n: number) =>
  action("math", {
    WFMathOperation: "/",
    WFMathOperand: { Value: { string: String(n) }, WFSerializationType: "WFTextTokenString" },
  });

const getItem = (which: "First Item" | "Last Item") => action("getitemfromlist", { WFItemSpecifier: which });
const getProperty = (prop: string) => action("properties", { WFPropertyName: prop });
const formatDate = (fmt: string) => action("format.date", { WFDateFormatStyle: "Custom", WFDateFormat: fmt });

/** POST a JSON body. fieldMap: { jsonKey: "VariableName" } */
const postJson = (url: string, fieldMap: Record<string, string>) =>
  action("downloadurl", {
    WFURL: url,
    WFHTTPMethod: "POST",
    WFHTTPBodyType: "JSON",
    WFJSONValues: {
      WFSerializationType: "WFDictionaryFieldValue",
      Value: {
        WFDictionaryFieldValueItems: Object.entries(fieldMap).map(([k, v]) => ({
          WFItemType: 0,
          WFKey: { Value: { string: k }, WFSerializationType: "WFTextTokenString" },
          WFValue: variable(v),
        })),
      },
    },
  });

const notify = (body: string) =>
  action("notification.create", {
    WFNotificationActionTitle: "SleepSync",
    WFNotificationActionBody: body,
    WFNotificationActionSound: false,
  });

const minutesOf = (varName: string, category: number): Dict[] => [
  healthQuery(category),
  sumDuration(),
  mathDivide(60), // seconds → minutes
  setVar(varName),
];

// ── the shortcut ─────────────────────────────────────────────────────────────

/** HealthKit sleep categories (watchOS 9+): 3 = AsleepCore (light), 4 = AsleepDeep, 5 = AsleepREM. */
function buildActions(endpoint: string): Dict[] {
  return [
    // look-back window: 18 h covers last night
    action("date"),
    action("adjustdate", {
      WFAdjustOperation: "Subtract",
      WFDuration: { Value: { Magnitude: 18, Unit: "hr" }, WFSerializationType: "WFQuantityFieldValue" },
    }),
    setVar("From"),

    ...minutesOf("DeepMins", 4),
    ...minutesOf("RemMins", 5),
    ...minutesOf("LightMins", 3),

    // total = Deep + REM + Light
    getVar("DeepMins"),
    mathAdd("RemMins"),
    mathAdd("LightMins"),
    setVar("TotalMins"),

    // bedtime = start of the first sample
    healthQuery(),
    setVar("AllSamples"),
    getVar("AllSamples"),
    getItem("First Item"),
    getProperty("Start Date"),
    formatDate("HH:mm"),
    setVar("Bedtime"),

    // wake time = end of the last sample
    getVar("AllSamples"),
    getItem("Last Item"),
    getProperty("End Date"),
    formatDate("HH:mm"),
    setVar("WakeTime"),

    postJson(endpoint, {
      bedtime: "Bedtime",
      wake_time: "WakeTime",
      total_minutes: "TotalMins",
      deep_minutes: "DeepMins",
      rem_minutes: "RemMins",
      light_minutes: "LightMins",
    }),

    notify("Sleep data synced to SleepSync"),
  ];
}

function localIp(): string | undefined {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) return a.address;
    }
  }
  return undefined;
}

// ── main ─────────────────────────────────────────────────────────────────────

const arg = process.argv[2];
let base: string;
if (arg) {
  base = arg.replace(/\/+$/, "");
} else {
  const ip = localIp();
  if (!ip) {
    console.error("Could not detect your local IP. Pass your deployed URL instead:\n  npm run shortcut -- https://your-app.vercel.app");
    process.exit(1);
  }
  base = `http://${ip}:8000`;
}
const endpoint = `${base}/api/sleep/apple-health`;

const shortcut = {
  WFWorkflowMinimumClientVersion: 900,
  WFWorkflowMinimumClientVersionString: "900",
  WFWorkflowHasShortcutInputVariables: false,
  WFWorkflowIcon: { WFWorkflowIconStartColor: 431817727, WFWorkflowIconGlyphNumber: 59505 },
  WFWorkflowInputContentItemClasses: [],
  WFWorkflowActions: buildActions(endpoint),
  WFWorkflowTypes: [],
  WFWorkflowOutputContentItemClasses: [],
  WFWorkflowImportQuestions: [],
};

const out = fileURLToPath(new URL("../SleepSync.shortcut", import.meta.url));
writeFileSync(out, bplist(shortcut));

console.log(`
Endpoint baked in: ${endpoint}
Created: ${out}

Install on your iPhone
  AirDrop (or email) SleepSync.shortcut to your phone → open it → "Add Shortcut".
  If "Add Untrusted Shortcut" appears: Settings → Shortcuts → Allow Untrusted Shortcuts, then re-open the file.

Automate it
  Shortcuts → Automation → + → Personal Automation → "When my alarm stops"
  → New Blank Automation → Add Action → Run Shortcut → SleepSync → Done

If an action shows a warning after install
  Apple occasionally renames parameters between iOS versions. If a "Find Health Samples" step errors,
  tap it and re-select Sleep Analysis; for the filtered ones add a filter where Value = Asleep Deep /
  Asleep REM / Asleep Core. The URL and variable names are already filled in.
${base.startsWith("http://") ? "\nNote: this is a local address — the dev server must be started with HOST=0.0.0.0 and your phone on the same Wi-Fi.\n" : ""}`);
