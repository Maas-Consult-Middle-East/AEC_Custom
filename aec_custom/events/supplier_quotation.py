import json
import frappe

docname = frappe.form_dict.get("docname")
items = frappe.form_dict.get("items")

if not docname:
    frappe.throw("Missing Supplier Quotation name")

if not items:
    frappe.throw("Missing items")

# ERPNext v14 Server Script fix
# frappe.parse_json may not be available, use json.loads
try:
    items = json.loads(items)
except Exception:
    pass

doc = frappe.get_doc("Supplier Quotation", docname)

if doc.docstatus != 1:
    frappe.throw("This button is only for submitted Supplier Quotations")

if not doc.has_permission("write"):
    frappe.throw("You do not have permission to update this Supplier Quotation")

existing_rows = {}
for row in doc.get("items") or []:
    existing_rows[row.name] = row

updated_count = 0
added_count = 0

for item in items:
    item_code = item.get("item_code")

    if not item_code:
        continue

    if not frappe.db.exists("Item", item_code):
        frappe.throw("Item does not exist: " + item_code)

    item_doc = frappe.get_doc("Item", item_code)

    row_name = item.get("row_name")

    if row_name and row_name in existing_rows:
        row = existing_rows[row_name]
        updated_count = updated_count + 1
    else:
        row = doc.append("items", {})
        added_count = added_count + 1

    qty = item.get("qty") or 0
    rate = item.get("rate") or 0

    row.item_code = item_code
    row.item_name = item.get("item_name") or item_doc.item_name
    row.description = item.get("description") or item_doc.description or item_doc.item_name

    row.qty = qty
    row.rate = rate
    row.amount = qty * rate

    row.stock_uom = item_doc.stock_uom
    row.uom = item.get("uom") or item_doc.stock_uom
    row.conversion_factor = item.get("conversion_factor") or 1

    if item.get("warehouse"):
        row.warehouse = item.get("warehouse")

doc.flags.ignore_validate_update_after_submit = True

for row in doc.get("items") or []:
    row.flags.ignore_validate_update_after_submit = True

doc.run_method("calculate_taxes_and_totals")
doc.save(ignore_permissions=True)

frappe.response["message"] = {
    "status": "success",
    "updated": updated_count,
    "added": added_count
}