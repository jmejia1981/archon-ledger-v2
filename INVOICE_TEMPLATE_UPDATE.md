# Invoice Template Update - Modern Design

## What Changed

The PDF invoice generator has been completely redesigned to match the modern, professional template you provided. The new design features a clean Bill From/Bill To layout with a centered footer.

## New Template Layout

### 1. **Bill From / Bill To Header**
```
Bill From                          Bill To
Archon Construction LLC            Client Name
archonconstruction.co              client@email.com
(551) 212-8820                     (XXX) XXX-XXXX
```

### 2. **Invoice Details Row**
Four columns displaying:
- **Invoice Date** - Today's date
- **Due Date** - Payment due date
- **Payment Terms** - Net 30, Due on Receipt, etc.
- **Project Name** - The project this invoice is for

### 3. **Line Items Table**
Professional table with columns:
- Description
- Qty (Quantity)
- Unit Price
- Amount

### 4. **Totals Section**
Right-aligned totals showing:
- Subtotal
- Tax (if applicable)
- Retainage (if applicable)
- **Total** (Remaining Balance) - highlighted with background

### 5. **Centered Footer**
```
Archon Construction LLC · Teaneck, NJ · Licensed & Insured
archonconstruction.co · (551) 212-8820
```

## Files Updated

### 1. `lib/pdf-invoice.ts` - Complete Redesign
**Major Changes:**
- New invoice data structure
- Bill From/Bill To side-by-side layout
- Invoice details in 4-column grid
- Professional table styling with proper spacing
- Centered footer with company branding
- Modern color scheme (professional blue, light gray, dark text)

**Key Updates:**
- Replaced old "INVOICE" header with "Bill From/Bill To"
- Added `projectName` field (separate from `projectAddress`)
- Added `clientEmail` and `clientPhone` fields
- Removed text tagline from header (now in footer)
- Updated all formatting and spacing
- Changed color scheme to modern professional palette

### 2. `app/dashboard/invoices/[id]/page.tsx` - Data Pass-Through
**Updates:**
- Now passes `clientEmail` and `clientPhone` to PDF
- Passes `projectName` separately from address
- Updated company info to match new footer (LLC, Teaneck, NJ, phone, website)
- Removed tagline from PDF data

### 3. `PDF_INVOICE_FEATURE.md` - Documentation Updated
- Updated feature descriptions
- New layout section details
- Updated color scheme documentation
- Simplified customization guide

## Color Scheme

### New Colors
- **Professional Blue**: #2F5687 (RGB: 47, 86, 135) - For headers and accents
- **Light Gray**: #F0F2F5 (RGB: 240, 242, 245) - For table headers and totals background
- **Dark Text**: #333333 (RGB: 51, 51, 51) - For all body text
- **Border Gray**: #C8C8C8 (RGB: 200, 200, 200) - For table borders
- **White**: #FFFFFF (RGB: 255, 255, 255) - Backgrounds

## Data Fields

All invoice data is now properly mapped:

```typescript
{
  // Invoice Info
  invoiceNumber: "INV-001"
  invoiceDate: "2026-05-09"
  dueDate: "2026-05-21"
  paymentTerms: "Due on Receipt"
  
  // From (Company)
  companyName: "Archon Construction LLC"
  companyEmail: "archonconstruction.co"
  companyPhone: "(551) 212-8820"
  
  // To (Client)
  clientName: "Joe"
  clientEmail: "joe@email.com"
  clientPhone: "(555) 123-4567"
  clientAddress: "123 Main St"
  clientCity: "New York"
  
  // Project
  projectName: "Project: Test"
  
  // Items
  lineItems: [
    {
      description: "Project: Test",
      quantity: 1,
      unitPrice: 8000.00,
      amount: 8000.00
    }
  ],
  
  // Totals
  subtotal: 8000.00
  tax: 0
  retainage: 0
  remainingBalance: 8000.00
  
  // Optional
  notes: ""
  paymentTerms: "Due on Receipt"
}
```

## Font & Typography

- **Font Family**: Calibri (professional and clean)
- **Header Text**: 13pt bold for names
- **Labels**: 11pt bold
- **Body Text**: 10pt normal
- **Table Headers**: 10pt bold on light gray background
- **Footer**: 9pt centered

## New Features

✅ **Bill From/Bill To Layout**
- Company info on left
- Client info on right
- Professional side-by-side arrangement

✅ **Client Contact Info**
- Client email displayed
- Client phone displayed
- Easy to see key contact details

✅ **Project Name Field**
- Separate from address
- Clear project identification
- Displayed in invoice details row

✅ **Professional Footer**
- Centered on every page
- Company branding and contact info
- License and insured notice
- Website URL

✅ **Modern Color Scheme**
- Professional blue accents
- Light gray backgrounds for emphasis
- Good contrast for readability
- Clean, modern appearance

✅ **Improved Spacing**
- Proper margins (15mm)
- Clear separation between sections
- Professional whitespace usage
- Easy to read and scan

## Removed Features

❌ **Logo Support** (for this design)
- The new template uses company name only
- Logo support can be added back if needed

❌ **Text Tagline** (Professional Construction Services)
- Moved to footer if needed
- Now uses centered footer design

## Testing

To test the new template:

1. Open an invoice in the dashboard
2. Click "Download PDF"
3. Verify the PDF shows:
   - Bill From/Bill To layout (✓)
   - Invoice, due date, payment terms, project name (✓)
   - Line items table with proper formatting (✓)
   - Subtotal, tax, retainage, and total (✓)
   - Centered footer with company info (✓)

## Browser Compatibility

Works in all modern browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Next Steps (Optional)

If you want to customize further:

1. **Change Colors**: Edit `COLORS` object in `pdf-invoice.ts`
2. **Change Footer**: Edit footer text in the `generateInvoicePDF()` function
3. **Adjust Spacing**: Modify margins or yPosition increments
4. **Change Fonts**: Replace 'Calibri' with another supported font

## Summary

The invoice generator now produces professional, modern PDFs that match the template you provided. The new design emphasizes clarity and professionalism with:
- Clean Bill From/Bill To layout
- Complete client contact information
- Professional footer branding
- Modern color scheme
- Proper spacing and typography

The system automatically handles all data mapping and formatting, so you just need to provide the invoice data and the PDF will be generated correctly.
