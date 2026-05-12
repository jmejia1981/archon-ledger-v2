# Invoice PDF Design - Draft Preview

## Color Scheme Update

**Primary Color**: #1A3A6B (RGB: 26, 58, 107) - Dark Professional Blue
**Secondary Color**: #8FA3B8 (RGB: 143, 163, 184) - Soft Blue-Gray

## Layout Changes

✅ Invoice number **CENTERED** at top
✅ "Bill To" **RIGHT-ALIGNED** (opposite of Bill From)
✅ "BALANCE REMAINING" font matches "Description" (10pt bold)
✅ Proper column alignment throughout

---

## DRAFT LAYOUT (Visual Preview)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                       │
│                            INV-001                                   │
│                          INVOICE                                     │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│ Bill From                                                  Bill To   │
│ ════════════════════════════════════════════════════════════════════│
│                                                                       │
│ Archon Construction LLC              Joe                             │
│ archonconstruction.co                joe@email.com                   │
│ (551) 212-8820                       (555) 123-4567                  │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│ Invoice Date      Due Date        Payment Terms    Project Name      │
│ May 9, 2026       May 21, 2026     Due on Receipt   Project: Test   │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│ Description                           Qty    Unit Price     Amount   │
│ ═════════════════════════════════════════════════════════════════════│
│ Project: Test                         1      $8,000.00     $8,000.00 │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│                                          Subtotal     $8,000.00      │
│                                          ─────────────────────────   │
│                                         ╔═══════════════════════╗    │
│                                         ║ BALANCE REMAINING     ║    │
│                                         ║   $8,000.00          ║    │
│                                         ╚═══════════════════════╝    │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│ Archon Construction LLC · Teaneck, NJ · Licensed & Insured          │
│ archonconstruction.co · (551) 212-8820                              │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Specific Layout Details

### 1. **Invoice Number (Top Center)**
- **Position**: Centered horizontally on the page
- **Font**: Calibri 20pt Bold
- **Color**: Primary Blue (#1A3A6B)
- **Format**: "INV-{number}"
- **Sub-label**: "INVOICE" in 9pt Secondary Blue below

### 2. **Bill From / Bill To (Side by Side)**
- **Bill From**: Left-aligned at margin
  - Label: 11pt Bold Dark Text
  - Company: 13pt Bold Primary Blue
  - Email: 10pt Normal Dark Text
  - Phone: 10pt Normal Dark Text

- **Bill To**: Right-aligned (opposite side)
  - Label: 11pt Bold Dark Text (right-aligned)
  - Client Name: 13pt Bold Primary Blue (right-aligned)
  - Email: 10pt Normal Dark Text (right-aligned)
  - Phone: 10pt Normal Dark Text (right-aligned)

### 3. **Invoice Details Row**
- 4-column layout: Invoice Date | Due Date | Payment Terms | Project Name
- Background: Light Blue (#F5F8FC)
- All columns properly spaced and aligned

### 4. **Line Items Table**
- Headers: White text on Primary Blue (#1A3A6B)
- Columns: Description | Qty | Unit Price | Amount
- **Description** font: **10pt Bold** (for reference)
- Body rows: 10pt Normal on white/light alternating
- Proper decimal alignment for amounts

### 5. **Balance Remaining (NEW)**
- **Font Size**: 10pt Bold (MATCHES Description header font)
- **Label**: "BALANCE REMAINING"
- **Background**: Primary Blue (#1A3A6B) with white text
- **Layout**: Full-width box, right-aligned amount
- **Position**: Below totals with separator line above

### 6. **Footer (Centered)**
- Divider line above in Soft Border Gray
- Company info in Secondary Blue (#8FA3B8)
- Centered text: Company, Location, License info, Website, Phone

---

## Color Usage Summary

| Element | Color | Hex | RGB |
|---------|-------|-----|-----|
| Invoice Number | Primary | #1A3A6B | 26, 58, 107 |
| Company/Client Names | Primary | #1A3A6B | 26, 58, 107 |
| Table Headers | Primary (background) | #1A3A6B | 26, 58, 107 |
| Balance Remaining Box | Primary (background) | #1A3A6B | 26, 58, 107 |
| Body Text | Dark Text | #212F3D | 33, 47, 61 |
| Detail Row BG | Light BG | #F5F8FC | 245, 248, 252 |
| Borders/Lines | Border Gray | #C8D2DC | 200, 210, 220 |
| Section Labels | Dark Text | #212F3D | 33, 47, 61 |
| Footer Text | Secondary | #8FA3B8 | 143, 163, 184 |

---

## Column Alignment Details

### Invoice Details Row (Below separator line)
```
Invoice Date      │ Due Date        │ Payment Terms   │ Project Name
May 9, 2026       │ May 21, 2026    │ Due on Receipt  │ Project: Test
[left-aligned]    │ [left-aligned]  │ [left-aligned]  │ [left-aligned]
```

### Line Items Table
```
Description                           Qty    Unit Price     Amount
[Left-aligned, 50% width]         [center] [right-aligned] [right-aligned]
Project: Test                         1      $8,000.00      $8,000.00
```

### Totals Section (Right side only)
```
Subtotal          $8,000.00
[right-aligned]   [right-aligned]

─────────────────────────────
BALANCE REMAINING $8,000.00
[right-aligned]   [right-aligned]
```

---

## What's Different from Previous Version

| Feature | Previous | New Draft |
|---------|----------|-----------|
| Invoice Number Position | Top Right | **CENTER** |
| Bill To Position | Center | **RIGHT (opposite Bill From)** |
| Invoice Number Font Size | 18pt | 20pt (centered looks bigger) |
| BALANCE REMAINING Font | 12pt | **10pt (matches Description)** |
| Colors | #1F5599, #4682B4 | **#1A3A6B, #8FA3B8** |
| Column Alignment | Good | **Verified & Optimized** |

---

## Font Summary

- **Invoice Number Label**: 20pt Bold Primary Blue
- **"INVOICE" sub-label**: 9pt Normal Secondary Blue
- **Section Labels** (Bill From/To): 11pt Bold Dark Text
- **Company/Client Names**: 13pt Bold Primary Blue
- **Contact Info**: 10pt Normal Dark Text
- **Section Subheadings**: 10pt Normal Dark Text
- **Table Header** (Description, Qty, Unit Price, Amount): 10pt Bold White
- **Table Body**: 10pt Normal Dark Text
- **BALANCE REMAINING**: 10pt Bold White ✅ **MATCHES DESCRIPTION**
- **Footer**: 9pt Normal Secondary Blue

---

## Ready to Generate?

This draft shows:
✅ Centered invoice number
✅ Right-aligned "Bill To"
✅ New color scheme (#1A3A6B primary, #8FA3B8 secondary)
✅ "BALANCE REMAINING" matches Description font (10pt bold)
✅ Proper column alignment throughout
✅ Professional spacing and hierarchy

**Approve this layout and I'll finalize it!**

Would you like me to:
1. ✅ **Proceed with these changes** - Make it permanent
2. Adjust spacing/sizing
3. Change any alignment
4. Modify any other element
