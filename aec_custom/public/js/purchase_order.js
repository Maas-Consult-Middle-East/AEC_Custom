// ============================================================
// PURCHASE ORDER - WBS VALIDATION
// ============================================================

frappe.ui.form.on('Purchase Order', {
    setup(frm) {
        setup_wbs_queries(frm);
    },

    refresh(frm) {
        setup_wbs_queries(frm);
    },

    wbs(frm) {
        validate_wbs_release(frm.doc.wbs, () => {
            frm.set_value('wbs', '');
        });
    },

    async validate(frm) {
        const is_valid = await validate_wbs_budget(frm);

        if (!is_valid) {
            frappe.validated = false;
        }
    }
});


frappe.ui.form.on('Purchase Order Item', {
    wbs(frm, cdt, cdn) {
        const row = locals[cdt][cdn];

        validate_wbs_release(row.wbs, () => {
            frappe.model.set_value(cdt, cdn, 'wbs', '');
        });
    }
});


// ============================================================
// WBS QUERY FILTER
// ============================================================

function setup_wbs_queries(frm) {
    const wbs_filter = () => ({
        filters: [
            ['WBS', 'release', '>', 0]
        ]
    });

    // Parent WBS
    frm.set_query('wbs', wbs_filter);

    // Child table WBS
    frm.set_query('wbs', 'items', wbs_filter);
}


// ============================================================
// VALIDATE WBS RELEASE
// ============================================================

async function validate_wbs_release(wbs, clear_callback) {
    if (!wbs) {
        return true;
    }

    try {
        const response = await frappe.db.get_value(
            'WBS',
            wbs,
            'release'
        );

        const release = Number(
            response.message?.release || 0
        );

        if (release <= 0) {
            frappe.msgprint({
                title: __('Invalid WBS'),
                message: __(
                    'Budget or Release is not allocated for this WBS.'
                ),
                indicator: 'red'
            });

            clear_callback?.();

            return false;
        }

        return true;

    } catch (error) {
        console.error('WBS validation error:', error);

        clear_callback?.();

        return false;
    }
}


// ============================================================
// GET WBS RELEASES
// ============================================================

async function get_wbs_releases(wbs_list) {
    if (!wbs_list.length) {
        return {};
    }

    const rows = await frappe.db.get_list('WBS', {
        filters: {
            name: ['in', wbs_list]
        },
        fields: [
            'name',
            'release'
        ],
        limit_page_length: wbs_list.length
    });

    return rows.reduce((result, row) => {
        result[row.name] = Number(row.release || 0);
        return result;
    }, {});
}


// ============================================================
// GET COMMITTED AMOUNTS
// ============================================================

async function get_committed_amounts(wbs_list, current_docname) {
    if (!wbs_list.length) {
        return {};
    }

    const response = await frappe.call({
        method: 'frappe.desk.reportview.get',
        args: {
            doctype: 'Purchase Order',

            fields: [
                '`tabPurchase Order Item`.wbs',
                'SUM(`tabPurchase Order Item`.base_amount) as committed'
            ],

            filters: [
                ['Purchase Order', 'docstatus', '=', 1],
                ['Purchase Order Item', 'wbs', 'in', wbs_list]
            ],

            group_by: '`tabPurchase Order Item`.wbs',

            page_length: 5000
        }
    });

    const rows = extract_reportview_rows(response);

    const committed = {};

    rows.forEach(row => {
        if (!Array.isArray(row)) {
            return;
        }

        const wbs = row[0];
        const amount = Number(row[1] || 0);

        if (wbs) {
            committed[wbs] = amount;
        }
    });

    // Ensure all WBS have a value
    wbs_list.forEach(wbs => {
        committed[wbs] ??= 0;
    });

    return committed;
}


// ============================================================
// REPORTVIEW RESPONSE PARSER
// ============================================================

function extract_reportview_rows(response) {
    const message = response?.message;

    if (Array.isArray(message?.values)) {
        return message.values;
    }

    if (Array.isArray(message)) {
        return message;
    }

    if (Array.isArray(message?.rows)) {
        return message.rows;
    }

    if (Array.isArray(response?.result)) {
        return response.result;
    }

    return [];
}


// ============================================================
// GET WBS FINANCIAL INFO
// ============================================================

async function get_wbs_info(wbs_list, current_docname) {

    const [releases, committed] = await Promise.all([
        get_wbs_releases(wbs_list),
        get_committed_amounts(wbs_list, current_docname)
    ]);

    return wbs_list.reduce((result, wbs) => {

        const release = Number(releases[wbs] || 0);
        const committed_amount = Number(committed[wbs] || 0);

        result[wbs] = {
            release: release,
            committed: committed_amount,
            remaining: release - committed_amount
        };

        return result;

    }, {});
}


// ============================================================
// MAIN WBS BUDGET VALIDATION
// ============================================================

async function validate_wbs_budget(frm) {

    const doc = frm.doc;
    const errors = [];

    // --------------------------------------------
    // 1. Calculate current PO amount per WBS
    // --------------------------------------------

    const current_amounts = {};

    (doc.items || []).forEach(item => {

        if (!item.wbs) {
            return;
        }

        const amount = Number(item.base_amount || 0);

        current_amounts[item.wbs] =
            (current_amounts[item.wbs] || 0) + amount;
    });


    // --------------------------------------------
    // 2. Collect all WBS
    // --------------------------------------------

    const wbs_list = [
        ...new Set([
            ...Object.keys(current_amounts),
            ...(doc.wbs ? [doc.wbs] : [])
        ])
    ];

    if (!wbs_list.length) {
        return true;
    }


    // --------------------------------------------
    // 3. Get WBS release and committed amount
    // --------------------------------------------

    let wbs_info;

    try {

        frappe.dom.freeze(
            __('Checking WBS budget...')
        );

        wbs_info = await get_wbs_info(
            wbs_list,
            doc.name
        );

    } catch (error) {

        console.error(
            'WBS validation failed:',
            error
        );

        frappe.msgprint({
            title: __('WBS Validation Error'),
            message: __(
                'Unable to check WBS remaining budget.'
            ),
            indicator: 'red'
        });

        return false;

    } finally {

        frappe.dom.unfreeze();
    }


    // --------------------------------------------
    // 4. Validate row WBS totals
    // --------------------------------------------

    for (const [wbs, current_amount] of Object.entries(current_amounts)) {

        const info = wbs_info[wbs] || {
            release: 0,
            committed: 0,
            remaining: 0
        };

        if (current_amount > info.remaining) {

            errors.push({
                wbs: wbs,
                current_amount: current_amount,
                release: info.release,
                committed: info.committed,
                remaining: info.remaining
            });
        }
    }


    // --------------------------------------------
    // 5. Validate Header WBS
    // --------------------------------------------

    if (doc.wbs) {

        const info = wbs_info[doc.wbs] || {
            release: 0,
            committed: 0,
            remaining: 0
        };

        const po_total =
            Number(doc.base_net_total || 0);

        if (po_total > info.remaining) {

            errors.unshift({
                wbs: doc.wbs,
                current_amount: po_total,
                release: info.release,
                committed: info.committed,
                remaining: info.remaining,
                header: true
            });
        }
    }


    // --------------------------------------------
    // 6. Show errors
    // --------------------------------------------

    if (errors.length) {

        const message = errors.map(error => {

            const type = error.header
                ? __('Header WBS')
                : __('Item WBS');

            return `
                <div style="margin-bottom: 15px;">
                    <b>${type}: ${frappe.utils.escape_html(error.wbs)}</b>
                    <br>
                    ${__('Current PO Amount')}: 
                    <b>${format_currency(error.current_amount)}</b>
                    <br>
                    ${__('Release')}: 
                    ${format_currency(error.release)}
                    <br>
                    ${__('Already Committed')}: 
                    ${format_currency(error.committed)}
                    <br>
                    ${__('Remaining')}: 
                    <b>${format_currency(error.remaining)}</b>
                </div>
            `;

        }).join('<hr>');


        frappe.msgprint({
            title: __('WBS Remaining Exceeded'),
            message: message,
            indicator: 'red'
        });

        return false;
    }


    return true;
}