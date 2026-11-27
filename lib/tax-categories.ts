/**
 * Schedule C lines, and how a bank feed's own labels map onto them.
 *
 * The list was previously declared inside the expenses page. The reconciliation
 * queue writes to the same column, and two copies of a tax taxonomy drift — so it
 * lives here once.
 */

export const TAX_CATEGORY_OPTIONS = [
  'Advertising (Line 8)',
  'Car & Truck Expenses (Line 9)',
  'Contract Labor (Line 11)',
  'Depreciation (Line 13)',
  'Insurance (Line 15)',
  'Legal & Professional Services (Line 17)',
  'Office Expense (Line 18)',
  'Rent or Lease (Line 20)',
  'Repairs & Maintenance (Line 21)',
  'Supplies & Materials (Line 22)',
  'Taxes & Licenses (Line 23)',
  'Travel (Line 24a)',
  'Meals — 50% deductible (Line 24b)',
  'Utilities (Line 25)',
  'Wages (Line 26)',
  'Other Expense (Line 27a)',
] as const

export interface CategorySuggestion {
  /** Pre-selected Schedule C line, or null when the feed's label does not imply one. */
  taxCategory: string | null
  categoryGroup: 'direct-project-costs' | 'company-overhead'
  /** Shown beside the row when the treatment is not simply "book it". */
  warning?: string
}

/**
 * A starting point, never a decision.
 *
 * Plaid labels a merchant, not a purpose: the same hardware store is job material
 * on one line and a personal errand on the next, and only the person who spent it
 * knows which. Every suggestion here is editable before anything is written.
 *
 * Two carry warnings because the tax treatment differs from what the label
 * suggests, and getting them wrong overstates the deduction:
 *
 *   ENTERTAINMENT   not deductible at all for federal purposes since the 2017 Act
 *   FOOD_AND_DRINK  business meals are 50% deductible; a personal meal is not an
 *                   expense at all but a draw
 */
export function suggestFromFeedCategory(category: string | null): CategorySuggestion {
  switch ((category || '').toUpperCase()) {
    case 'FOOD_AND_DRINK':
      return {
        taxCategory: 'Meals — 50% deductible (Line 24b)',
        categoryGroup: 'company-overhead',
        warning: 'Only if this was a business meal — and it is 50% deductible, not 100%.',
      }
    case 'ENTERTAINMENT':
      return {
        taxCategory: null,
        categoryGroup: 'company-overhead',
        warning: 'Entertainment is not deductible federally. Owner draw is usually the right call.',
      }
    case 'TRANSPORTATION':
      return { taxCategory: 'Car & Truck Expenses (Line 9)', categoryGroup: 'company-overhead' }
    case 'TRAVEL':
      return { taxCategory: 'Travel (Line 24a)', categoryGroup: 'company-overhead' }
    case 'HOME_IMPROVEMENT':
      return { taxCategory: 'Supplies & Materials (Line 22)', categoryGroup: 'direct-project-costs' }
    case 'GENERAL_MERCHANDISE':
      return { taxCategory: 'Supplies & Materials (Line 22)', categoryGroup: 'direct-project-costs' }
    case 'RENT_AND_UTILITIES':
      return { taxCategory: 'Utilities (Line 25)', categoryGroup: 'company-overhead' }
    case 'BANK_FEES':
      return { taxCategory: 'Other Expense (Line 27a)', categoryGroup: 'company-overhead' }
    case 'GOVERNMENT_AND_NON_PROFIT':
      return { taxCategory: 'Taxes & Licenses (Line 23)', categoryGroup: 'company-overhead' }
    case 'PERSONAL_CARE':
      return {
        taxCategory: null,
        categoryGroup: 'company-overhead',
        warning: 'Personal spending is a draw, not a business cost.',
      }
    case 'GENERAL_SERVICES':
      // Covers everything from insurance to a subcontractor, so it implies nothing.
      return { taxCategory: null, categoryGroup: 'company-overhead' }
    default:
      return { taxCategory: null, categoryGroup: 'company-overhead' }
  }
}
