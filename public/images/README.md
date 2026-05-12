# Archon Invoice Images

This directory stores images used in PDF invoice generation.

## Adding the Archon Logo

1. Save your Archon Construction logo image as `archon-logo.png` in this directory
2. Recommended specifications:
   - Format: PNG with transparency (recommended)
   - Size: ~600x400 pixels (or maintain 3:2 aspect ratio)
   - Quality: High resolution for professional PDFs
   - File size: Keep under 500KB for optimal performance

## File Structure

- `archon-logo.png` - Main company logo used in invoice headers

## Current Setup

The PDF invoice generator will:
1. Check for `archon-logo.png` in this folder
2. If found, display it prominently at the top of invoices
3. If not found, fall back to text-only header with company name and contact info

## Usage in Code

The logo is automatically loaded and embedded in PDFs through:
- `lib/image-utils.ts` - Image loading and conversion utilities
- `lib/pdf-invoice.ts` - PDF generation with logo support
- `app/dashboard/invoices/[id]/page.tsx` - Invoice detail page that triggers PDF download

To use a different logo path:
1. Edit `lib/image-utils.ts` and modify the `getArchonLogo()` function
2. Update the image path to point to your desired logo location
