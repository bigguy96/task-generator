const STORAGE_KEY = "taskGeneratorState";

const DEFAULT_STATE = {
  connection: {
    organization: "",
    project: "",
    team: "",
    pat: "",
    apiVersion: "7.1",
    effortFieldName: "Microsoft.VSTS.Scheduling.Effort"
  },
  classificationPaths: {
    areas: [],
    iterations: [],
    currentIterationPath: "",
    activityValues: []
  },
  templates: [
    {
      enabled: true,
      title: "Dev",
      description: "Implement the requested change and update any related code, configuration, or documentation needed for the work item.",
      assignedTo: "",
      effort: "4",
      remainingWork: "4",
      activity: "Development",
      tags: "",
      areaPath: "",
      iterationPath: "",
      customFields: ""
    },
    {
      enabled: true,
      title: "Dev QA",
      description: "Validate the implementation in the development environment and record any defects or follow-up work.",
      assignedTo: "",
      effort: "2",
      remainingWork: "2",
      activity: "Testing",
      tags: "",
      areaPath: "",
      iterationPath: "",
      customFields: ""
    },
    {
      enabled: true,
      title: "Deploy to development",
      description: "Deploy the completed change to the development environment and confirm the deployment completed successfully.",
      assignedTo: "",
      effort: "1",
      remainingWork: "1",
      activity: "Deployment",
      tags: "",
      areaPath: "",
      iterationPath: "",
      customFields: ""
    },
    {
      enabled: true,
      title: "Deploy to acceptance",
      description: "Deploy the validated change to the acceptance environment and confirm the deployment completed successfully.",
      assignedTo: "",
      effort: "1",
      remainingWork: "1",
      activity: "Deployment",
      tags: "",
      areaPath: "",
      iterationPath: "",
      customFields: ""
    },
    {
      enabled: true,
      title: "UAT",
      description: "Support user acceptance testing, confirm expected behavior, and capture any required follow-up work.",
      assignedTo: "",
      effort: "2",
      remainingWork: "2",
      activity: "Testing",
      tags: "",
      areaPath: "",
      iterationPath: "",
      customFields: ""
    }
  ]
};

const fields = {
  organization: document.querySelector("#organization"),
  project: document.querySelector("#project"),
  team: document.querySelector("#team"),
  pat: document.querySelector("#pat"),
  apiVersion: document.querySelector("#apiVersion"),
  effortFieldName: document.querySelector("#effortFieldName"),
  parentId: document.querySelector("#parentId")
};

const saveAllButton = document.querySelector("#saveAll");
const generateButton = document.querySelector("#generate");
const addTemplateButton = document.querySelector("#addTemplate");
const resetTemplatesButton = document.querySelector("#resetTemplates");
const loadPathsButton = document.querySelector("#loadPaths");
const togglePatButton = document.querySelector("#togglePat");
const templatesContainer = document.querySelector("#templates");
const templateElement = document.querySelector("#templateCard");
const statusElement = document.querySelector("#status");

let state = structuredClone(DEFAULT_STATE);
let persistTimer = null;

document.addEventListener("DOMContentLoaded", init);
saveAllButton.addEventListener("click", saveFromForm);
generateButton.addEventListener("click", generateTasks);
addTemplateButton.addEventListener("click", addTemplate);
resetTemplatesButton.addEventListener("click", resetTemplates);
loadPathsButton.addEventListener("click", loadClassificationPaths);
togglePatButton.addEventListener("click", togglePatVisibility);

async function init() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  state = mergeState(DEFAULT_STATE, stored[STORAGE_KEY]);
  render();

  if (hasCompleteConnection()) {
    refreshDevOpsLists({ silent: true });
  }
}

function mergeState(defaultState, storedState) {
  if (!storedState) {
    return structuredClone(defaultState);
  }

  return {
    connection: {
      ...defaultState.connection,
      ...storedState.connection
    },
    classificationPaths: {
      ...defaultState.classificationPaths,
      ...storedState.classificationPaths
    },
    templates: Array.isArray(storedState.templates) && storedState.templates.length > 0
      ? storedState.templates.map((template) => ({ ...newTemplate(), ...template }))
      : structuredClone(defaultState.templates)
  };
}

function render() {
  fields.organization.value = state.connection.organization;
  fields.project.value = state.connection.project;
  fields.team.value = state.connection.team;
  fields.pat.value = state.connection.pat;
  fields.pat.type = "password";
  togglePatButton.textContent = "Show";
  fields.apiVersion.value = state.connection.apiVersion;
  fields.effortFieldName.value = state.connection.effortFieldName;

  templatesContainer.replaceChildren();
  state.templates.forEach((template, index) => {
    templatesContainer.appendChild(renderTemplate(template, index));
  });
}

function renderTemplate(template, index) {
  const fragment = templateElement.content.cloneNode(true);
  const card = fragment.querySelector(".template-card");
  card.dataset.index = String(index);

  for (const input of card.querySelectorAll("[data-field]")) {
    const field = input.dataset.field;
    if (input.tagName === "SELECT") {
      populatePathSelect(input, field, template[field]);
    }

    if (input.type === "checkbox") {
      input.checked = Boolean(template[field]);
    } else {
      input.value = template[field] ?? "";
    }

    input.addEventListener("input", () => updateTemplateFromInput(index, input));
    input.addEventListener("change", () => updateTemplateFromInput(index, input));
  }

  card.querySelector("[data-action='remove']").addEventListener("click", () => removeTemplate(index));
  return fragment;
}

function togglePatVisibility() {
  const isHidden = fields.pat.type === "password";
  fields.pat.type = isHidden ? "text" : "password";
  togglePatButton.textContent = isHidden ? "Hide" : "Show";
}

function populatePathSelect(select, field, selectedValue) {
  const options = ["", ...getSelectOptions(field)];

  if (selectedValue && !options.includes(selectedValue)) {
    options.push(selectedValue);
  }

  select.replaceChildren(...options.map((path) => {
    const option = document.createElement("option");
    option.value = path;
    option.textContent = path || "No selection";
    return option;
  }));
}

function getSelectOptions(field) {
  if (field === "areaPath") {
    return state.classificationPaths.areas;
  }

  if (field === "iterationPath") {
    return state.classificationPaths.iterations;
  }

  if (field === "activity") {
    return state.classificationPaths.activityValues;
  }

  return [];
}

function updateTemplateFromInput(index, input) {
  const value = input.type === "checkbox" ? input.checked : input.value;
  state.templates[index] = {
    ...state.templates[index],
    [input.dataset.field]: value
  };
  schedulePersistState();
}

async function saveFromForm() {
  syncConnectionFromForm();
  await persistState();
  showStatus("Settings and templates saved.", "success");

  if (hasCompleteConnection()) {
    await refreshDevOpsLists({ silent: false });
  }
}

function syncConnectionFromForm() {
  state.connection = {
    organization: fields.organization.value.trim(),
    project: fields.project.value.trim(),
    team: fields.team.value.trim(),
    pat: fields.pat.value.trim(),
    apiVersion: fields.apiVersion.value.trim() || "7.1",
    effortFieldName: fields.effortFieldName.value.trim() || DEFAULT_STATE.connection.effortFieldName
  };
}

async function persistState() {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

function schedulePersistState() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    syncConnectionFromForm();
    persistState();
  }, 250);
}

function addTemplate() {
  syncConnectionFromForm();
  state.templates.push(newTemplate(state.classificationPaths.currentIterationPath));
  render();
  persistState();
}

function resetTemplates() {
  syncConnectionFromForm();
  state.templates = structuredClone(DEFAULT_STATE.templates);
  applyDefaultIterationToTemplates();
  render();
  persistState();
}

function newTemplate(defaultIterationPath = "") {
  return {
    enabled: true,
    title: "",
    description: "",
    assignedTo: "",
    effort: "",
    remainingWork: "",
    activity: "",
    tags: "",
    areaPath: "",
    iterationPath: defaultIterationPath,
    customFields: ""
  };
}

function removeTemplate(index) {
  syncConnectionFromForm();
  state.templates.splice(index, 1);
  render();
  persistState();
}

async function loadClassificationPaths() {
  await refreshDevOpsLists({ silent: false });
}

async function refreshDevOpsLists({ silent }) {
  try {
    syncConnectionFromForm();
    validateConnection();
    setBusy(true);
    if (!silent) {
      showStatus("Refreshing Azure DevOps lists...");
    }

    const [areas, iterationData, activityValues] = await Promise.all([
      fetchClassificationPaths("areas", state.connection),
      fetchIterationPaths(state.connection),
      fetchActivityValues(state.connection)
    ]);
    const currentIterationPath = iterationData.currentIterationPath || findCurrentIterationPath(iterationData.nodes);
    const iterations = iterationData.paths;

    state.classificationPaths = { areas, iterations, currentIterationPath, activityValues };
    normalizeTemplateSelections();
    applyDefaultIterationToTemplates();
    await persistState();
    render();
    if (!silent) {
      showStatus(buildLoadedListsMessage(areas, iterations, activityValues, currentIterationPath), "success");
    }
  } catch (error) {
    showStatus(error.message || "Could not refresh Azure DevOps lists.", "error");
  } finally {
    setBusy(false);
  }
}

function normalizeTemplateSelections() {
  state.templates = state.templates.map((template) => ({
    ...template,
    areaPath: template.areaPath ? normalizeClassificationPath(template.areaPath, "areas") : "",
    iterationPath: template.iterationPath ? normalizeClassificationPath(template.iterationPath, "iterations") : ""
  }));
}

function applyDefaultIterationToTemplates() {
  const currentIterationPath = state.classificationPaths.currentIterationPath;
  if (!currentIterationPath) {
    return;
  }

  state.templates = state.templates.map((template) => ({
    ...template,
    iterationPath: template.iterationPath || currentIterationPath
  }));
}

function buildLoadedListsMessage(areas, iterations, activityValues, currentIterationPath) {
  const message = `Loaded ${areas.length} area path${areas.length === 1 ? "" : "s"}, ${iterations.length} iteration path${iterations.length === 1 ? "" : "s"}, and ${activityValues.length} activit${activityValues.length === 1 ? "y" : "ies"}.`;
  if (!currentIterationPath) {
    return `${message}\nNo current sprint was found from iteration dates.`;
  }

  return `${message}\nDefault iteration set to: ${currentIterationPath}`;
}

async function generateTasks() {
  try {
    syncConnectionFromForm();
    await persistState();

    const parentId = Number(fields.parentId.value);
    validateInputs(parentId);

    setBusy(true);
    showStatus("Creating tasks...");

    const enabledTemplates = state.templates.filter((template) => template.enabled);
    const results = [];

    for (const template of enabledTemplates) {
      const workItem = await createTask(parentId, template, state.connection);
      results.push(`#${workItem.id}: ${workItem.fields["System.Title"]}`);
    }

    showStatus(`Created ${results.length} task${results.length === 1 ? "" : "s"}:\n${results.join("\n")}`, "success");
  } catch (error) {
    showStatus(error.message || "Something went wrong while creating tasks.", "error");
  } finally {
    setBusy(false);
  }
}

function validateInputs(parentId) {
  const missing = [];
  missing.push(...getMissingConnectionFields());
  if (!Number.isInteger(parentId) || parentId <= 0) missing.push("parent work item ID");

  const enabledTemplates = state.templates.filter((template) => template.enabled);
  if (enabledTemplates.length === 0) missing.push("at least one enabled task template");
  if (enabledTemplates.some((template) => !template.title.trim())) missing.push("a title for every enabled task");
  if (!isFieldReferenceName(state.connection.effortFieldName)) missing.push("a valid effort field reference");

  if (missing.length > 0) {
    throw new Error(`Please provide ${missing.join(", ")}.`);
  }
}

function validateConnection() {
  const missing = getMissingConnectionFields();
  if (missing.length > 0) {
    throw new Error(`Please provide ${missing.join(", ")}.`);
  }
}

function hasCompleteConnection() {
  return getMissingConnectionFields().length === 0;
}

function getMissingConnectionFields() {
  const missing = [];
  if (!state.connection.organization) missing.push("organization");
  if (!state.connection.project) missing.push("project");
  if (!state.connection.team) missing.push("team");
  if (!state.connection.pat) missing.push("personal access token");
  return missing;
}

function isFieldReferenceName(value) {
  return /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)+$/.test(value || "");
}

async function createTask(parentId, template, connection) {
  const org = encodeUrlSegment(connection.organization);
  const project = encodeUrlSegment(connection.project);
  const apiVersion = encodeURIComponent(connection.apiVersion || "7.1");
  const baseUrl = `https://dev.azure.com/${org}/${project}/_apis/wit`;
  const url = `${baseUrl}/workitems/$Task?api-version=${apiVersion}`;
  const parentUrl = `${baseUrl}/workItems/${parentId}`;
  const operations = buildPatchOperations(template, parentUrl, connection);

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Authorization": `Basic ${btoa(`:${connection.pat}`)}`,
      "Content-Type": "application/json-patch+json"
    },
    body: JSON.stringify(operations)
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || payload?.error || response.statusText;
    throw new Error(`Azure DevOps rejected "${template.title}": ${message}`);
  }

  return payload;
}

async function fetchClassificationPaths(structureGroup, connection) {
  const rootNode = await fetchClassificationRoot(structureGroup, connection);
  return flattenClassificationPaths(rootNode, structureGroup);
}

async function fetchIterationPaths(connection) {
  const [rootNode, currentIterationPath] = await Promise.all([
    fetchClassificationRoot("iterations", connection),
    fetchCurrentTeamIterationPath(connection)
  ]);
  return {
    paths: flattenClassificationPaths(rootNode, "iterations"),
    nodes: flattenClassificationNodes(rootNode, "iterations"),
    currentIterationPath
  };
}

async function fetchActivityValues(connection) {
  const org = encodeUrlSegment(connection.organization);
  const project = encodeUrlSegment(connection.project);
  const fieldName = encodeUrlSegment("Microsoft.VSTS.Common.Activity");
  const params = new URLSearchParams({
    "api-version": connection.apiVersion || "7.1"
  });
  const url = `https://dev.azure.com/${org}/${project}/_apis/wit/workitemtypes/Task/fields/${fieldName}?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${btoa(`:${connection.pat}`)}`,
      "Accept": "application/json"
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || payload?.error || response.statusText;
    throw new Error(`Azure DevOps could not load Task activity values: ${message}`);
  }

  return [...new Set((payload?.allowedValues || []).map((value) => String(value)))].sort((a, b) => a.localeCompare(b));
}

async function fetchCurrentTeamIterationPath(connection) {
  const org = encodeUrlSegment(connection.organization);
  const project = encodeUrlSegment(connection.project);
  const team = encodeUrlSegment(connection.team);
  const params = new URLSearchParams({
    "$timeframe": "current",
    "api-version": connection.apiVersion || "7.1"
  });
  const url = `https://dev.azure.com/${org}/${project}/${team}/_apis/work/teamsettings/iterations?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${btoa(`:${connection.pat}`)}`,
      "Accept": "application/json"
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || payload?.error || response.statusText;
    throw new Error(`Azure DevOps could not load the current sprint for team "${connection.team}": ${message}`);
  }

  const path = payload?.value?.[0]?.path || "";
  return path ? normalizeClassificationPath(path, "iterations") : "";
}

async function fetchClassificationRoot(structureGroup, connection) {
  const org = encodeUrlSegment(connection.organization);
  const project = encodeUrlSegment(connection.project);
  const params = new URLSearchParams({
    "$depth": "10",
    "api-version": connection.apiVersion || "7.1"
  });
  const url = `https://dev.azure.com/${org}/${project}/_apis/wit/classificationnodes/${structureGroup}?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${btoa(`:${connection.pat}`)}`,
      "Accept": "application/json"
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || payload?.error || response.statusText;
    throw new Error(`Azure DevOps could not load ${structureGroup}: ${message}`);
  }

  return payload;
}

function flattenClassificationPaths(rootNode, structureGroup) {
  const paths = [];
  const visit = (node) => {
    if (node?.path) {
      paths.push(normalizeClassificationPath(node.path, structureGroup));
    }

    for (const child of node?.children || []) {
      visit(child);
    }
  };

  visit(rootNode);
  return [...new Set(paths)].sort((a, b) => a.localeCompare(b));
}

function flattenClassificationNodes(rootNode, structureGroup) {
  const nodes = [];
  const visit = (node) => {
    if (node?.path) {
      nodes.push({
        path: normalizeClassificationPath(node.path, structureGroup),
        startDate: node.attributes?.startDate,
        finishDate: node.attributes?.finishDate
      });
    }

    for (const child of node?.children || []) {
      visit(child);
    }
  };

  visit(rootNode);
  return nodes;
}

function normalizeClassificationPath(path, structureGroup) {
  const structuralSegment = structureGroup === "areas" ? "Area" : "Iteration";
  const parts = path.replace(/^\\+/, "").split("\\");

  if (parts[1] === structuralSegment) {
    parts.splice(1, 1);
  }

  return parts.join("\\");
}

function findCurrentIterationPath(iterationNodes) {
  const today = new Date();
  const currentIterations = iterationNodes.filter((node) => {
    if (!node.startDate || !node.finishDate) {
      return false;
    }

    const startDate = new Date(node.startDate);
    const finishDate = new Date(node.finishDate);
    finishDate.setHours(23, 59, 59, 999);
    return startDate <= today && today <= finishDate;
  });

  currentIterations.sort((a, b) => b.path.length - a.path.length);
  return currentIterations[0]?.path || "";
}

function buildPatchOperations(template, parentUrl, connection) {
  const operations = [
    addField("System.Title", template.title.trim()),
    addField("System.Description", template.description.trim()),
    {
      op: "add",
      path: "/relations/-",
      value: {
        rel: "System.LinkTypes.Hierarchy-Reverse",
        url: parentUrl,
        attributes: {
          comment: "Created by Azure DevOps Task Generator"
        }
      }
    }
  ];

  addOptionalField(operations, "System.AssignedTo", template.assignedTo);
  addOptionalNumberField(operations, connection.effortFieldName || DEFAULT_STATE.connection.effortFieldName, template.effort);
  addOptionalNumberField(operations, "Microsoft.VSTS.Scheduling.RemainingWork", template.remainingWork);
  addOptionalField(operations, "Microsoft.VSTS.Common.Activity", template.activity);
  addOptionalField(operations, "System.Tags", template.tags);
  addOptionalField(operations, "System.AreaPath", template.areaPath);
  addOptionalField(operations, "System.IterationPath", template.iterationPath);
  addCustomFields(operations, template.customFields);

  return operations;
}

function addField(name, value) {
  return {
    op: "add",
    path: `/fields/${escapeJsonPointer(name)}`,
    value
  };
}

function addOptionalField(operations, name, value) {
  if (value?.trim()) {
    operations.push(addField(name, value.trim()));
  }
}

function addOptionalNumberField(operations, name, value) {
  if (value === "" || value == null) {
    return;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }

  operations.push(addField(name, numericValue));
}

function addCustomFields(operations, customFields) {
  if (!customFields?.trim()) {
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(customFields);
  } catch {
    throw new Error("Custom fields must be valid JSON.");
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Custom fields must be a JSON object.");
  }

  for (const [fieldName, value] of Object.entries(parsed)) {
    if (!fieldName.trim()) {
      throw new Error("Custom field names cannot be empty.");
    }
    operations.push(addField(fieldName.trim(), value));
  }
}

function escapeJsonPointer(value) {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

function encodeUrlSegment(value) {
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
}

function showStatus(message, type = "") {
  statusElement.textContent = message;
  statusElement.className = `status visible ${type}`.trim();
}

function setBusy(isBusy) {
  generateButton.disabled = isBusy;
  saveAllButton.disabled = isBusy;
  addTemplateButton.disabled = isBusy;
  resetTemplatesButton.disabled = isBusy;
  loadPathsButton.disabled = isBusy;
  togglePatButton.disabled = isBusy;
}
