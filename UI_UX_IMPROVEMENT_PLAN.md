# Fitness App UI/UX Improvement Plan

## Global Design System

### Typography Scale
- **Heading 1 (H1)**: 28px, 700 weight, 1.3 line height
- **Heading 2 (H2)**: 24px, 600 weight, 1.3 line height
- **Heading 3 (H3)**: 20px, 600 weight, 1.3 line height
- **Body**: 16px, 400 weight, 1.5 line height
- **Subheading**: 14px, 500 weight, 1.4 line height
- **Caption**: 12px, 400 weight, 1.4 line height
- **Button**: 16px, 600 weight, 1.2 line height

### Spacing Scale
- **Micro**: 4px
- **Small**: 8px
- **Medium**: 16px
- **Large**: 24px
- **XLarge**: 32px
- **XXLarge**: 48px

### Button Text Alignment Rules
- All buttons must have consistent 16px padding horizontally
- Vertical padding: 12px for regular buttons, 16px for primary buttons
- Icon and text spacing: 8px between icon and text
- Text must be centered vertically within button bounds
- Minimum button width: 88px (for touch targets)

### Card Content Alignment Rules
- Cards must have 16px padding on all sides
- Icons and text in cards must be left-aligned with 8px spacing between
- Numbers in stats must be right-aligned with labels below
- Card headers must have 8px bottom margin to content

### Color Contrast Requirements (WCAG AAA)
- Text on background: Minimum 7:1 contrast ratio
- Small text (under 18px): Minimum 4.5:1 contrast ratio
- Interactive elements: Minimum 3:1 contrast ratio

### Touch Target Minimum Sizes
- All interactive elements: 48px × 48px minimum
- Buttons: Minimum width 88px, height 48px
- Icon-only buttons: Minimum 48px × 48px
- Tappable areas: Minimum 8px padding around all interactive elements

---

## Page-Specific Improvements

### 1. Home Page

#### Current Issues
- "Welcome to Pulse" green text has low contrast on dark hero background
- Bottom navigation icons are inconsistent in size and spacing
- Active challenge text is cropped or overlapping
- Stat card icons are too close to numbers

#### Proposed Changes
- Increase contrast of "Welcome to Pulse" text
- Standardize bottom navigation icons to 24px with 4px spacing
- Fix text alignment in active challenge section
- Increase spacing between stat card icons and numbers

#### Design Tokens
- "Welcome to Pulse" text color: #FFFFFF (from current low-contrast green)
- Bottom nav icon size: 24px × 24px
- Bottom nav icon spacing: 4px between icon and label
- Stat card icon-text spacing: 16px (from current 8px)
- Active challenge padding: 12px all around

#### Priority: P0

### 2. Exercises Page

#### Current Issues
- Font hierarchy unclear between headlines and subtext
- Button padding inconsistent
- Icon-text spacing cramped in exercise cards

#### Proposed Changes
- Establish clear visual hierarchy with proper font weights and sizes
- Standardize button padding across all interactive elements
- Increase spacing between icons and text in exercise cards

#### Design Tokens
- Exercise title: H3 (20px, 600 weight)
- Exercise description: Body (16px, 400 weight)
- Button padding: 16px horizontal, 12px vertical
- Exercise card icon-text spacing: 12px (from current 6px)
- Exercise card padding: 16px all around

#### Priority: P1

### 3. Feed Page

#### Current Issues
- Text alignment inconsistent in feed cards
- Vertical gaps between sections uneven
- Stat numbers too small relative to labels

#### Proposed Changes
- Align all text consistently left-aligned with proper padding
- Standardize vertical spacing between sections using spacing scale
- Increase size of stat numbers relative to labels

#### Design Tokens
- Feed card padding: 16px all around
- Section spacing: 24px (from current inconsistent values)
- Stat number size: 32px (from current 20px)
- Stat label size: 14px (from current 12px)
- Stat number-label spacing: 4px

#### Priority: P1

### 4. Nutrition Page

#### Current Issues
- Icons misaligned with text in buttons
- Font hierarchy unclear between nutritional information
- Color contrast insufficient for some text elements

#### Proposed Changes
- Align icons with text using consistent 8px spacing
- Establish clear hierarchy for nutritional information
- Ensure all text meets WCAG AAA contrast requirements

#### Design Tokens
- Button icon-text spacing: 8px
- Macro title: H3 (20px, 600 weight)
- Macro value: Body (16px, 400 weight)
- Macro unit: Caption (12px, 400 weight)
- Text contrast: #FFFFFF on #1E1E1E (14.6:1 ratio)

#### Priority: P1

### 5. Stats Page

#### Current Issues
- Stat card layout inconsistent
- Numbers too small relative to labels
- Color contrast insufficient for some stat elements

#### Proposed Changes
- Standardize stat card layout with consistent padding and alignment
- Increase size of stat numbers for better readability
- Ensure all stat elements meet contrast requirements

#### Design Tokens
- Stat card padding: 16px all around
- Stat number size: 36px (from current 24px)
- Stat label size: 14px (from current 12px)
- Stat card spacing: 16px between cards
- Text contrast: #000000 on #FFFFFF (21:1 ratio)

#### Priority: P0

### 6. Profile Page

#### Current Issues
- Text alignment inconsistent across profile elements
- Spacing between profile elements uneven
- Avatar and text misaligned

#### Proposed Changes
- Align all profile elements consistently left-aligned
- Standardize spacing using spacing scale
- Properly align avatar with profile information

#### Design Tokens
- Profile section padding: 24px (top/bottom), 16px (left/right)
- Profile element spacing: 16px between elements
- Avatar-text spacing: 16px
- Profile name: H2 (24px, 600 weight)
- Profile bio: Body (16px, 400 weight)

#### Priority: P1

### 7. Settings Page

#### Current Issues
- Font hierarchy unclear between setting categories
- Toggle switches misaligned with text
- Button padding inconsistent

#### Proposed Changes
- Establish clear hierarchy for setting categories
- Align toggle switches with text using consistent spacing
- Standardize button padding across all settings

#### Design Tokens
- Setting category title: H3 (20px, 600 weight)
- Setting description: Body (16px, 400 weight)
- Toggle switch-text spacing: 16px
- Button padding: 16px horizontal, 12px vertical
- Setting section spacing: 24px

#### Priority: P2

### 8. AI Generator Wizard (5 steps)

#### Current Issues
- Progress indicator unclear
- Text alignment inconsistent in form fields
- Button spacing inconsistent between steps

#### Proposed Changes
- Clarify progress indicator with visual steps
- Align all form field elements consistently
- Standardize button spacing across all steps

#### Design Tokens
- Progress indicator height: 4px
- Progress indicator spacing: 8px between steps
- Form field padding: 12px all around
- Form field label-text spacing: 8px
- Button spacing: 16px between buttons
- Form field icon-text spacing: 12px

#### Priority: P0

### 9. Workout Session Page

#### Current Issues
- Timer text too small
- Exercise name and misaligned with rest timer
- Color contrast insufficient for some text

#### Proposed Changes
- Increase size of timer text for better visibility
- Align exercise name with rest timer
- Ensure all text meets contrast requirements

#### Design Tokens
- Timer text size: 48px (from current 32px)
- Exercise name size: 24px (from current 18px)
- Rest timer size: 18px (from current 14px)
- Text contrast: #FFFFFF on #1E1E1E (14.6:1 ratio)
- Exercise element spacing: 16px

#### Priority: P0

### 10. Body Metrics Page

#### Current Issues
- Metric cards have inconsistent padding
- Numbers too small relative to labels
- Icon-text spacing cramped

#### Proposed Changes
- Standardize metric card padding
- Increase size of metric numbers
- Increase spacing between icons and text

#### Design Tokens
- Metric card padding: 16px all around
- Metric number size: 32px (from current 20px)
- Metric label size: 14px (from current 12px)
- Icon-text spacing: 16px (from current 8px)
- Metric card spacing: 16px between cards

#### Priority: P1

### 11. Challenges Page

#### Current Issues
- "ACTIVE CHALLENGE" text cropped/overlapping
- Challenge cards have inconsistent spacing
- Progress bar alignment unclear

#### Proposed Changes
- Fix text alignment in active challenge section
- Standardize challenge card spacing
- Clarify progress bar alignment with challenge information

#### Design Tokens
- Active challenge padding: 16px all around
- Challenge card padding: 20px all around
- Challenge card spacing: 16px between cards
- Progress bar height: 8px
- Progress bar-text spacing: 8px
- Challenge title: H3 (20px, 600 weight)
- Challenge description: Body (16px, 400 weight)

#### Priority: P0

---

## Implementation Roadmap

### Phase 1 (P0 - Critical Issues)
1. Home Page - Fix contrast and alignment issues
2. Stats Page - Improve stat card layout and readability
3. AI Generator Wizard - Clarify progress indicators
4. Workout Session Page - Improve timer visibility
5. Challenges Page - Fix active challenge text alignment

### Phase 2 (P1 - Important Issues)
1. Exercises Page - Establish clear hierarchy
2. Feed Page - Standardize layout and spacing
3. Nutrition Page - Fix button alignment and contrast
4. Profile Page - Standardize element alignment
5. Body Metrics Page - Improve metric card layout

### Phase 3 (P2 - Lower Priority)
1. Settings Page - Improve form alignment and hierarchy

## Success Metrics
- 100% compliance with WCAG AAA contrast requirements
- Consistent spacing across all screens (±2px tolerance)
- All interactive elements meet minimum touch target sizes
- Font hierarchy clearly established and consistently applied
- All text properly aligned with no overlapping or cropping
