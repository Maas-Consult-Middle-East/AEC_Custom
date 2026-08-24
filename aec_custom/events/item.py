def set_item_name(doc, method):
    base = (doc.custom_base_name or "").strip()
    material = doc.custom_material or ""
    item_type = doc.custom_item_type or ""

    parts = [p for p in [material, item_type] if p]

    if base and parts:
        doc.item_name = base + " - " + " ".join(parts)
    elif base:
        doc.item_name = base
    elif parts:
        doc.item_name = " ".join(parts)