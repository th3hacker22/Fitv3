# Pulse Fitness UI/UX Improvement Plan

## Global Design Tokens

### Typography Scale
- **H1**: 2.5rem / 40px (Bold / 700)
- **H2**: 2rem / 32px (Semi-bold / 600)
- **H3**: 1.5rem / 24px (Medium / 500)
- **Body**: 1rem / 16px (Regular / 400)
- **Caption**: 0.75rem / 12px (Regular / 400)
- **Button**: 1rem / 16px (Medium / 500)

### Spacing Scale
- **4px**: 0.25rem
- **8px**: 0.5rem
- **12px**: 0.75rem
- **16px**: 1rem
- **24px**: 1.5rem
- **32px**: 2rem
- **48px**: 3rem

### Button Rules
- **Padding**: Horizontal: 16px, Vertical: 12px
- **Text Alignment**: Center
- **Min Size**: 48px × 48px (touch target)
- **Icon-Text Gap**: 8px
- **Border Radius**: 8px

### Card Rules
- **Padding**: 16px
- **Header-to-Content Gap**: 8px
- **Alignment**: Left-aligned content, right-aligned actions

### Color Contrast Rules
- **Text on Light Background**: #212121 (ratio 14.5:1)
- **Text on Dark Background**: #FFFFFF (ratio 21:1)
- **Primary Color**: #6200EE (with appropriate contrast ratios)
- **Secondary Color**: #03DAC5 (with appropriate contrast ratios)

### Touch Target Rules
- **Minimum Size**: 48px × 48px
- **Spacing Between Targets**: 8px minimum

### Bottom Navigation Rules
- **Icon Size**: 24px × 24px
- **Label Size**: 0.875rem / 14px (Regular / 400)
- **Active State**: Primary color (#6200EE) for icon and text
- **Inactive State**: #757575
- **Padding**: 8px vertical, 16px horizontal

---

## Page-Specific Improvements

### Home Page

**Current Issues:**
- Welcome text misaligned with user avatar (4px offset to the right)
- Activity cards have inconsistent padding (12px vs 16px)
- Progress ring contrast insufficient (3.5:1 ratio)
- "Today's Goals" section text has poor contrast (4.2:1 ratio)

**Proposed Changes:**
- Align welcome text with avatar container left edge
- Standardize all card padding to 16px
- Increase progress ring contrast with darker stroke
- Increase text contrast in goals section

**Design Tokens:**
- Welcome text: #212121, 1.5rem / 24px, Medium / 500
- Card padding: 16px all sides
- Progress ring: #6200EE stroke width 4px, background #F5F5F5
- Goal text: #212121, 1rem / 16px, Regular / 400

**Priority:** P0

### Exercises Page

**Current Issues:**
- Exercise category grid has inconsistent spacing (16px horizontal, 12px vertical)
- Exercise cards have no visual hierarchy
- Filter button has insufficient touch target (40px × 40px)
- Exercise name text too small (0.875rem / 14px)

**Proposed Changes:**
- Implement 8px grid spacing throughout
- Add card elevation and consistent styling
- Enlarge filter button to 48px × 48px
- Increase exercise name text size

**Design Tokens:**
- Grid spacing: 8px all around
- Card elevation: 2px, border radius 8px, padding 16px
- Filter button: 48px × 48px, padding 8px, border radius 8px
- Exercise name: 1.125rem / 18px, Medium / 500

**Priority:** P1

### Feed Page

**Current Issues:**
- Post images have inconsistent aspect ratios
- Like/comment buttons too close together (4px spacing)
- User name text too light (#757575) with poor contrast (3.1:1)
- Timestamp text not readable (4.5:1 ratio)

**Proposed Changes:**
- Standardize image aspect ratio to 16:9
- Increase spacing between interactive elements
- Increase user name text contrast
- Adjust timestamp color for better contrast

**Design Tokens:**
- Image aspect ratio: 16:9
- Interactive element spacing: 16px minimum
- User name: #212121, 1rem / 16px, Medium / 500
- Timestamp: #616161, 0.875rem / 14px, Regular / 400

**Priority:** P1

### Nutrition Page

**Current Issues:**
- Macro circles have insufficient contrast (2.8:1 ratio)
- Food log entries have inconsistent alignment
- Water tracker progress bar too thin (4px)
- Add button too small (40px × 40px)

**Proposed Changes:**
- Increase macro circle contrast with darker borders
- Standardize food log entry alignment
- Increase water tracker progress bar thickness
- Enlarge add button to 48px × 48px

**Design Tokens:**
- Macro circle: #212121 stroke width 3px, fill #F5F5F5
- Food log padding: 16px left, 8px right, 12px top/bottom
- Progress bar: 8px height, #6200EE
- Add button: 48px × 48px, border radius 24px

**Priority:** P0

### Stats Page

**Current Issues:**
- Chart labels too small (0.75rem / 12px) with poor contrast (4.2:1)
- Date picker has insufficient touch targets (36px × 36px)
- Stat cards have inconsistent padding (12px vs 16px)
- Export button has poor contrast (3.5:1)

**Proposed Changes:**
- Increase chart label text size and contrast
- Enlarge date picker touch targets
- Standardize stat card padding
- Increase export button contrast

**Design Tokens:**
- Chart labels: 0.875rem / 14px, #212121, Regular / 400
- Date picker: 48px × 48px touch targets
- Stat card padding: 16px all sides
- Export button: #6200EE text on #FFFFFF background

**Priority:** P1

### Profile Page

**Current Issues:**
- Profile image not circular (border radius 8px)
- Achievement badges overlapping (no spacing)
- Edit profile button too small (40px × 40px)
- Stats text inconsistent (mix of 1rem and 1.125rem)

**Proposed Changes:**
- Make profile image fully circular (border radius 50%)
- Add 8px spacing between achievement badges
- Enlarge edit profile button to 48px × 48px
- Standardize stats text size

**Design Tokens:**
- Profile image: 120px × 120px, border radius 60px
- Badge spacing: 8px all around
- Edit button: 48px × 48px, border radius 8px
- Stats text: 1rem / 16px, #212121, Medium / 500

**Priority:** P1

### Settings Page

**Current Issues:**
- Settings groups not visually separated
- Toggle switches too small (40px width)
- Back button icon not centered (2px offset)
- Footer text too light (#9E9E9E) with poor contrast (3.1:1)

**Proposed Changes:**
- Add visual dividers between settings groups
- Enlarge toggle switches to 48px width
- Center back button icon
- Increase footer text contrast

**Design Tokens:**
- Group divider: #E0E0E0, 1px height, 16px inset
- Toggle width: 48px, height: 24px
- Back button: 48px × 48px touch target
- Footer text: #616161, 0.875rem / 14px, Regular / 400

**Priority:** P2

### AI Generator Wizard (5 steps)

**Current Issues:**
- Progress indicator dots too small (8px diameter)
- Step title text inconsistent (mix of 1.25rem and 1.5rem)
- Form fields have insufficient padding (12px)
- Next button not disabled when required fields empty

**Proposed Changes:**
- Increase progress indicator dot size
- Standardize step title text size
- Increase form field padding
- Implement proper validation for next button

**Design Tokens:**
- Progress dot: 12px diameter, #6200EE for active, #E0E0E0 for inactive
- Step title: 1.5rem / 24px, #212121, Medium / 500
- Form field: 16px padding, border radius 8px
- Next button: 16px horizontal, 12px vertical padding, border radius 8px

**Priority:** P0

### Workout Session Page

**Current Issues:**
- Exercise timer text too small (1.25rem / 20px)
- Rest timer has poor contrast (3.2:1)
- Exercise list items have inconsistent spacing
- Complete button too small (40px × 40px)

**Proposed Changes:**
- Increase timer text size
- Improve rest timer contrast
- Standardize exercise list spacing
- Enlarge complete button

**Design Tokens:**
- Timer text: 2rem / 32px, #FFFFFF, Bold / 700
- Rest timer: #212121 on #F5F5F5 background
- List item spacing: 8px vertical, 16px horizontal
- Complete button: 48px × 48px, border radius 8px

**Priority:** P0

### Body Metrics Page

**Current Issues:**
- Metric cards have inconsistent padding (12px vs 16px)
- Add measurement button too small (40px × 40px)
- Chart has no data labels
- History timeline text too small (0.75rem / 12px)

**Proposed Changes:**
- Standardize metric card padding
- Enlarge add measurement button
- Add data labels to chart
- Increase history timeline text size

**Design Tokens:**
- Metric card padding: 16px all sides
- Add button: 48px × 48px, border radius 24px
- Chart labels: 0.875rem / 14px, #212121, Regular / 400
- Timeline text: 0.875rem / 14px, #616161, Regular / 400

**Priority:** P1

### Challenges Page

**Current Issues:**
- Challenge cards have no elevation
- Join button has poor contrast (3.5:1)
- Challenge description text too small (0.875rem / 14px)
- Progress bars too thin (4px)

**Proposed Changes:**
- Add elevation to challenge cards
- Increase join button contrast
- Increase description text size
- Thicken progress bars

**Design Tokens:**
- Card elevation: 2px, border radius 8px
- Join button: #FFFFFF text on #6200EE background
- Description text: 1rem / 16px, #212121, Regular / 400
- Progress bar: 8px height, #6200EE

**Priority:** P1
