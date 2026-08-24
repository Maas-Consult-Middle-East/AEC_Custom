frappe.ui.form.on("Supplier Quotation", {
    refresh(frm) {
        if (frm.doc.docstatus === 1) {
            frm.add_custom_button(__("Update Items"), function () {
                open_supplier_quotation_update_items_dialog(frm);
            }, __("Actions"));
        }
    }
});

function open_supplier_quotation_update_items_dialog(frm) {
    const current_items = (frm.doc.items || []).map(row => {
        return {
            row_name: row.name,
            item_code: row.item_code,
            item_name: row.item_name,
            description: row.description,
            uom: row.uom,
            qty: row.qty,
            rate: row.rate,
            warehouse: row.warehouse
        };
    });

    const dialog = new frappe.ui.Dialog({
        title: __("Update Items"),
        size: "extra-large",
        fields: [
            {
                fieldname: "items",
                fieldtype: "Table",
                label: __("Items"),
                cannot_add_rows: false,
                in_place_edit: true,
                data: current_items,
                fields: [
                    {
                        fieldname: "row_name",
                        fieldtype: "Data",
                        hidden: 1
                    },
                    {
                        fieldname: "item_code",
                        fieldtype: "Link",
                        label: __("Item"),
                        options: "Item",
                        in_list_view: 1,
                        reqd: 1,
                        columns: 2
                    },
                    {
                        fieldname: "item_name",
                        fieldtype: "Data",
                        label: __("Item Name"),
                        in_list_view: 1,
                        columns: 2
                    },
                    {
                        fieldname: "qty",
                        fieldtype: "Float",
                        label: __("Qty"),
                        in_list_view: 1,
                        reqd: 1,
                        columns: 1
                    },
                    {
                        fieldname: "rate",
                        fieldtype: "Currency",
                        label: __("Rate"),
                        in_list_view: 1,
                        reqd: 1,
                        columns: 1
                    },
                    {
                        fieldname: "uom",
                        fieldtype: "Link",
                        label: __("UOM"),
                        options: "UOM",
                        in_list_view: 1,
                        columns: 1
                    },
                    {
                        fieldname: "warehouse",
                        fieldtype: "Link",
                        label: __("Warehouse"),
                        options: "Warehouse",
                        in_list_view: 1,
                        columns: 1
                    },
                    {
                        fieldname: "description",
                        fieldtype: "Small Text",
                        label: __("Description")
                    }
                ]
            }
        ],
        primary_action_label: __("Update"),
        primary_action(values) {
            const rows = (values.items || []).filter(row => row.item_code);

            if (!rows.length) {
                frappe.msgprint(__("Please add at least one item."));
                return;
            }

            frappe.call({
                method: "aec_custom.aec_custom.doctype.supplier_quotation.supplier_quotation.custom_update_supplier_quotation_items",
                args: {
                    docname: frm.doc.name,
                    items: JSON.stringify(rows)
                },
                freeze: true,
                freeze_message: __("Updating items..."),
                callback(r) {
                    if (!r.exc) {
                        dialog.hide();
                        frappe.show_alert({
                            message: __("Supplier Quotation items updated"),
                            indicator: "green"
                        });
                        frm.reload_doc();
                    }
                }
            });
        }
    });

    dialog.show();
}