# Archon Logo Setup Guide

## Quick Setup (5 minutes)

### Step 1: Prepare Your Logo
- Export your Archon Construction logo as a PNG image
- Name it: `archon-logo.png`
- Recommended size: 600×400 pixels
- Make sure to use a format with transparency if possible (PNG)

### Step 2: Add Logo to Project
1. Create a folder: `public/images/` (if it doesn't exist)
2. Place your `archon-logo.png` file in that folder

Your folder structure should look like:
```
archon-ledger-v2/
├── public/
│   └── images/
│       ├── archon-logo.png  ← Your logo here
│       └── README.md
├── app/
├── lib/
└── [other folders]
```

### Step 3: Test It Out
1. Open the Archon Ledger application
2. Go to the Invoices section
3. Open any invoice detail page
4. Click "Download PDF"
5. The PDF should now display with your logo in the header!

## What Happens Automatically

Once `archon-logo.png` is in place:
- The system automatically detects the logo
- The logo is loaded and converted to base64
- The logo is embedded in every PDF invoice
- No additional configuration needed

## Fallback Behavior

If the logo file is not found:
- PDFs will display a text-only header
- Company name "ARCHON CONSTRUCTION" appears in large bold text
- Tagline and contact info are shown below
- All invoice information is intact and correct

## Image Specifications

### Recommended Dimensions
- **Width**: 600 pixels
- **Height**: 400 pixels
- **Aspect Ratio**: 3:2 (ideal for professional invoices)

### File Requirements
- **Format**: PNG (preferred) or JPG
- **Color Depth**: RGB or RGBA (with transparency)
- **File Size**: Under 500KB for optimal performance
- **Resolution**: 72 DPI minimum (screen resolution is fine)

### Design Tips
- Use a clear, clean logo without too much detail
- Light backgrounds work best on invoices
- Avoid very small text within the logo
- Consider how the logo looks at 30mm width

## Customization

### Change Logo Path
If you want to use a different folder or filename:

1. Edit `lib/image-utils.ts`
2. Find the `getArchonLogo()` function
3. Change the path:

```typescript
export async function getArchonLogo(): Promise<string> {
  return imageToBase64('/images/your-custom-logo.png')  // Change this
}
```

### Change Logo Size
To adjust how large the logo appears:

1. Edit `lib/pdf-invoice.ts`
2. Find the logo sizing section (around line 65-70)
3. Modify these values:

```typescript
const logoHeight = 20  // mm - increase for larger logo
const logoWidth = 30   // mm - increase for larger logo
```

### Multiple Logos
To support different logos (e.g., by client):

1. Add multiple logo files to `public/images/`
2. Create a function in `lib/image-utils.ts`:

```typescript
export async function getClientLogo(clientId: string): Promise<string> {
  return imageToBase64(`/images/logo-${clientId}.png`)
}
```

3. Use it in the invoice detail page when generating PDFs

## Troubleshooting

### Logo not appearing in PDF
- Check that `archon-logo.png` exists in `public/images/`
- Verify the file format is PNG or JPG
- Check browser console for errors
- Clear browser cache and try again

### Logo looks blurry
- Use a higher resolution image (at least 600×400)
- Make sure image quality is high
- Avoid stretching the image

### PDF generation is slow
- Reduce the file size of your logo
- Compress the image before saving
- Use JPG format instead of PNG if needed

### Logo filename wrong
- Check spelling: must be exactly `archon-logo.png`
- Must be lowercase
- Must be in `public/images/` folder

## Technical Details

### How Logo Loading Works

1. **PDF Download Click**
   - User clicks "Download PDF" button
   - `handleDownloadPDF()` is called

2. **Logo Loading**
   - `getArchonLogo()` function is called
   - Fetches the image from `/images/archon-logo.png`
   - Converts image to base64 format
   - Returns base64 string or empty string if not found

3. **PDF Generation**
   - Invoice data is passed to `generateInvoicePDF()`
   - If logoImage is provided, it's embedded in the PDF
   - Logo is rendered at top-left of invoice
   - Company info displayed beside the logo

4. **Download**
   - PDF file is generated in browser
   - Downloaded with invoice number as filename

## Files Involved

- `public/images/archon-logo.png` - Your logo file
- `lib/image-utils.ts` - Image loading utilities
- `lib/pdf-invoice.ts` - PDF generation with logo support
- `app/dashboard/invoices/[id]/page.tsx` - Invoice detail page

## Support

For issues or questions:
1. Check the `public/images/README.md` file
2. Review the `PDF_INVOICE_FEATURE.md` documentation
3. Check the troubleshooting section above
4. Review browser console for error messages

## Next Steps

After adding your logo:
1. Generate a test invoice PDF
2. Review the appearance
3. Adjust logo size if needed
4. Share invoices with clients with your professional branding!
