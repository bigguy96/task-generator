# Azure DevOps Task Generator

Chrome Manifest V3 extension for creating a saved series of Azure DevOps Tasks under a parent work item.

The popup logo uses a parent work item branching into generated child tasks. The browser toolbar uses separate PNG icons with a green task-card mark so it stays readable at small sizes.

## Load locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this repository folder.

## Use

1. Enter your Azure DevOps organization, project, team, and a PAT with work item read/write access. The PAT is masked by default and can be revealed with **Show**.
2. Click **Refresh Lists** to load area paths, iteration paths, and activity values from Azure DevOps. The current sprint is loaded from the selected team and used as the default iteration for templates without an iteration. These lists also refresh automatically when the popup opens with saved credentials or after credentials are saved.
3. Add or edit task templates. Template changes are saved locally as you edit them. Use **Load Defaults** to restore the Dev/QA/deploy/UAT sequence.
4. Enter the parent work item ID.
5. Click **Generate Tasks**.

The extension stores connection settings, task templates, selected dropdown values, and refreshed Azure DevOps lists in `chrome.storage.local`.

## Supported task fields

- `System.Title`
- `System.Description`
- `System.AssignedTo`
- `Microsoft.VSTS.Scheduling.Effort` from the Effort field by default. This can be changed in **Effort field reference**.
- `Microsoft.VSTS.Scheduling.RemainingWork`
- `Microsoft.VSTS.Common.Activity`
- `System.Tags`
- `System.AreaPath`
- `System.IterationPath`
- Custom fields from a JSON object, for example:

```json
{
  "Custom.ReleaseNoteRequired": true,
  "Custom.ReviewType": "Security"
}
```

Created tasks are linked to the parent work item using `System.LinkTypes.Hierarchy-Reverse`.

The default templates are Dev, Dev QA, Deploy to development, Deploy to acceptance, and UAT. Area path, iteration path, and activity are selected from dropdowns loaded from Azure DevOps. Effort and remaining work can be edited per template before generation.

Azure DevOps API classification paths are normalized before use, so structural API segments such as `Area` and `Iteration` are not sent as work item field values.
