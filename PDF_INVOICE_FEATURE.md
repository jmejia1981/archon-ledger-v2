# Professional PDF Invoice Generator

## Overview
The system now includes a professional PDF invoice generator that creates beautiful, modern invoices with the Archon Construction branding. The template features a clean Bill From/Bill To layout with comprehensive invoice details and a professional footer.

## Features

### 1. **Modern Professional Design**
- "Bill From" and "Bill To" side-by-side layout
- Invoice date, due date, payment terms, and project name display
- Archon Construction branding with footer information
- Clean, minimalist design with light gray accents
- Professional typography using Calibri font

### 2. **Complete Invoice Information**
- Invoice number and date (formatted as Month DD, YYYY)
- Due date with payment terms
- Client name, email, and phone
- Project name field
- Line items with Description, Qty, Unit Price, and Amount
- Subtotal, tax, and retainage calculations
- Total amount (remaining balance) prominently displayed

### 3. **Line Items Support**
- Multiple line items per invoice
- Quantity and unit price per item
- Automatic amount calculations
- Clear itemization with professional table formatting

### 4. **Professional Formatting**
- Currency formatting (US dollars with 2 decimal places)
- Date formatting (Month DD, YYYY)
- Proper alignment (left for descriptions, right for amounts)
- Professional typography with Calibri font throughout
- Consistent spacing and margins

### 5. **Footer Branding**
- Centered footer with company information
- "Archon Construction LLC · Teaneck, NJ · Licensed & Insured"
- Website and phone contact details
- Appears on every invoice for professional branding

## Files

### New Files
- `lib/pdf-invoice.ts` - PDF generation library using jsPDF
- `lib/image-utils.ts` - Image loading and base64 conversion utilities
- `public/images/README.md` - Guide for adding logo and images

### Modified Files
- `app/dashboard/invoices/[id]/page.tsx` - Added PDF download functionality with logo support

## How to Use

### Setting Up the Logo

1. **Add your logo image:**
   - Save your Archon Construction logo as `archon-logo.png`
   - Place it in the `public/images/` folder
   - Recommended format: PNG with transparency
   - Recommended size: 600x400 pixels or similar aspect ratio

2. **The system will automatically:**
   - Detect the logo file
   - Convert it to base64 for PDF embedding
   - Display it prominently in invoice headers
   - Fall back to text-only header if logo is missing

### From Invoice Detail Page
1. Open an invoice detail page
2. Click the "Download PDF" button in the header
3. Invoice PDF downloads to your computer with the invoice number as filename
   - If logo is available: PDF displays with logo header
   - If no logo: PDF displays text-only header
4. Can also use "Print" button to print directly

### Programmatic Usage
```typescript
import { downloadInvoicePDF, generateInvoicePDFBlob } from '@/lib/pdf-invoice'
import { getArchonLogo, imageToBase64 } from '@/lib/image-utils'

// Download with automatic logo loading
const logoImage = await getArchonLogo()
downloadInvoicePDF({
  ...invoiceData,
  logoImage: logoImage,
}, 'invoice-001.pdf')

// Download with custom logo
const customLogo = await imageToBase64('/images/custom-logo.png')
downloadInvoicePDF({
  ...invoiceData,
  logoImage: customLogo,
}, 'invoice-001.pdf')

// Download without logo
downloadInvoicePDF(invoiceData, 'invoice-001.pdf')

// Get as Blob for custom handling
const blob = await generateInvoicePDFBlob(invoiceData)
```

## Invoice Data Structure

```typescript
interface InvoiceData {
  invoiceNumber: string          // INV-001
  invoiceDate: string            // YYYY-MM-DD
  dueDate: string                // YYYY-MM-DD
  clientName: string             // Client company/person
  clientEmail?: string           // Client email address
  clientPhone?: string           // Client phone number
  clientAddress?: string         // Street address
  clientCity?: string            // City
  clientState?: string           // State
  clientZip?: string             // ZIP code
  projectName?: string           // Project name
  projectAddress?: string        // Project location/address
  projectCity?: string           // Project city
  projectState?: string          // Project state
  companyName?: string           // Company name (Archon Construction LLC)
  companyEmail?: string          // Company email/website
  companyPhone?: string          // Company phone
  logoImage?: string             // Base64 encoded logo image or data URL
  lineItems: LineItemData[]      // Array of line items
  subtotal: number               // Subtotal amount
  tax?: number                   // Tax amount
  retainage?: number             // Retainage amount
  amountPaid?: number            // Amount already paid
  remainingBalance: number       // Balance due (Total)
  notes?: string                 // Additional notes
  paymentTerms?: string          // Payment terms (Due on Receipt, Net 30, etc.)
}

interface LineItemData {
  description: string            // Item description
  quantity: number               // Quantity
  unitPrice: number              // Unit price
  amount: number                 // Total amount (qty × price)
}
```

## PDF Output Details

### Page Settings
- **Format:** US Letter (8.5" × 11")
- **Margins:** 15mm on all sides
- **Font:** Calibri throughout
- **Colors:**
  - Accents: Professional Blue (#2F5687)
  - Text: Dark Gray (#333333)
  - Backgrounds: Light Gray (#F0F2F5)
  - Borders: Medium Gray (#C8C8C8)

### Layout Sections
1. **Bill From/Bill To** - Company and client information side-by-side
2. **Invoice Details** - Date, due date, payment terms, project name (4-column layout)
3. **Line Items Table** - Description, Qty, Unit Price, Amount columns
4. **Totals Section** - Subtotal, tax, retainage, and total (right-aligned)
5. **Footer** - Centered company branding with address, phone, website, and license info

## Dependencies

### Required Package
```json
"jspdf": "^2.5.0",
"jspdf-autotable": "^3.5.0"
```

**Note:** These packages need to be installed if not already present:
```bash
npm install jspdf jspdf-autotable
```

## Styling Customization

To customize the appearance, edit these constants in `lib/pdf-invoice.ts`:

```typescript
const COLORS = {
  darkBlue: [47, 86, 135],        // Professional Blue accents (#2F5687)
  lightGray: [240, 242, 245],     // Light background (#F0F2F5)
  darkText: [51, 51, 51],         // Body text (#333333)
  borderGray: [200, 200, 200],    // Table borders (#C8C8C8)
  white: [255, 255, 255],         // White
}
```

### Customizing Colors
1. Edit the COLORS object values (RGB array format)
2. Example: `darkBlue: [47, 86, 135]` represents #2F5687

### Customizing Fonts
- Font: Calibri (set in `doc.setFont('Calibri', 'normal')`)
- To change: Replace 'Calibri' with 'Helvetica', 'Arial', or other jsPDF-supported fonts

### Customizing Footer
The footer text is hardcoded in the PDF generation. To change:
```typescript
const footerText = 'Your Company Name  ·  City, State  ·  License Info          website.com  ·  (XXX) XXX-XXXX'
```

## Integration Points

### Invoice Detail Page
- "Download PDF" button in header
- Builds invoice data from current state
- Passes line items, client info, and payment details
- Uses invoice number as filename

### Future Integration Points
1. Email as attachment
2. Bulk PDF generation
3. Invoice templates
4. Custom branding per company
5. Logo integration

## Technical Notes

### Browser Compatibility
- Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- Uses client-side generation (no server processing needed)
- No external API calls required

### Performance
- PDF generation is instant for typical invoices
- File sizes typically 50-150KB depending on content
- Suitable for downloading and emailing

### Data Handling
- All data passed locally, no external services
- PDF generated entirely on client
- No sensitive data sent to servers
- Safe to use with confidential information

## Examples

### Example 1: Generate and Download
```typescript
const invoiceData = {
  invoiceNumber: 'INV-001',
  invoiceDate: '2026-05-09',
  dueDate: '2026-05-16',
  clientName: 'ABC Construction',
  clientAddress: '123 Main St',
  clientCity: 'New York',
  clientState: 'NY',
  clientZip: '10001',
  projectAddress: '16 Bailey Avenue',
  lineItems: [
    {
      description: 'Labor - Exterior Paint',
      quantity: 1,
      unitPrice: 6000,
      amount: 6000,
    },
  ],
  subtotal: 6000,
  tax: 0,
  retainage: 0,
  amountPaid: 2700,
  remainingBalance: 3300,
  notes: 'Payment due within 30 days',
  paymentTerms: 'Net 30',
}

downloadInvoicePDF(invoiceData, 'invoice-001.pdf')
```

### Example 2: Multiple Line Items
```typescript
const invoiceData = {
  // ... common fields ...
  lineItems: [
    {
      description: 'Labor - Exterior Paint',
      quantity: 1,
      unitPrice: 6000,
      amount: 6000,
    },
    {
      description: 'Materials - Premium Paint (5 gallons)',
      quantity: 5,
      unitPrice: 150,
      amount: 750,
    },
    {
      description: 'Equipment Rental - Scaffolding (3 days)',
      quantity: 3,
      unitPrice: 200,
      amount: 600,
    },
  ],
  subtotal: 7350,
  // ... rest of data ...
}
```

## Troubleshooting

### PDF Not Downloading
- Check browser console for errors
- Ensure jsPDF library is loaded
- Verify all required invoice data is provided

### Text Formatting Issues
- Check that descriptions aren't too long (will wrap automatically)
- Ensure amounts are valid numbers
- Verify date strings are in YYYY-MM-DD format

### Missing Styling
- Confirm COLORS constants are correct
- Check browser doesn't have custom PDF styles blocking colors
- Test with different browsers

## Future Enhancements

- [ ] Logo/image integration
- [ ] Custom color schemes per client
- [ ] Multiple invoice templates
- [ ] Email delivery integration
- [ ] Invoice scheduling and reminders
- [ ] Batch PDF generation
- [ ] QR code for online payments
- [ ] Multi-page invoices for large line item lists
- [ ] Watermark support (Draft, Paid, etc.)
- [ ] Signature line for approval

## Support

For issues or customization needs:
1. Check the PDF generation logic in `lib/pdf-invoice.ts`
2. Review browser console for errors
3. Verify all invoice data fields are correctly populated
4. Test with sample data first
