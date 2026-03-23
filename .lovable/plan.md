

## Fix: CSV Template Download Not Working

**Problem**: The `downloadTemplate()` function in `BulkInviteDialog.tsx` creates a temporary `<a>` element and clicks it, but never appends it to the DOM. Some browsers (especially within sandboxed iframes like the Lovable preview) require the element to be in the document for the click to trigger a download.

**Solution**: Append the anchor element to `document.body` before clicking, then remove it afterward.

**File: `src/components/BulkInviteDialog.tsx`** — Update the `downloadTemplate` function:

```typescript
function downloadTemplate() {
  const headerComment = "# Valid roles: crew, location_manager, org_admin. Phone and employee_id are optional.";
  const csv = [headerComment, TEMPLATE_HEADERS.join(","), ...TEMPLATE_EXAMPLE].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "team_invite_template.csv";
  document.body.appendChild(a);  // <-- Must be in DOM for sandboxed contexts
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

This is a one-line fix (plus the cleanup line). No other files need to change.

