
# History Item Detail View Implementation

## Overview
Add an expandable detail panel to each history item in the sidebar. When the user clicks the chevron arrow (>), it will expand to show comprehensive details about that encoding/decoding operation.

## What You'll See
- Clicking the ">" arrow on any history item will smoothly expand a details section
- The arrow will rotate to indicate the expanded state
- Details will include the secret message, image previews (if available), and quality metrics
- Clicking again will collapse the details

## Implementation Details

### 1. Update HistorySidebar Component

**Add expanded state tracking:**
- Track which history item is currently expanded using `useState`
- Toggle expansion when clicking the chevron button

**Fetch additional fields from database:**
- Add `message`, `cover_image_url`, `stego_image_url`, `ssim_score` to the query
- Update the `HistoryItem` interface to include these fields

**Add expandable detail section:**
- Use Collapsible component from Radix UI for smooth animation
- Display details in a clean grid layout when expanded:
  - Secret message (truncated with option to expand)
  - Cover image thumbnail (if URL exists)
  - Stego image thumbnail (if URL exists)  
  - PSNR and SSIM quality metrics
  - Full timestamp
  - Processing time

### 2. UI Design
```text
+----------------------------------------+
| [icon] filename.png                    |
|        ENCODE  • 5 min ago • 120ms     |
|                                    [>] |
+----------------------------------------+
         ↓ (when expanded)
+----------------------------------------+
| [icon] filename.png                    |
|        ENCODE  • 5 min ago • 120ms     |
|                                    [v] |
|----------------------------------------|
| Secret Message:                        |
| "Hidden text content..."               |
|----------------------------------------|
| Quality Metrics:                       |
| PSNR: 42.5 dB  |  SSIM: 0.98          |
|----------------------------------------|
| Images:                                |
| [Cover Img]     [Stego Img]           |
|----------------------------------------|
| Created: Jan 26, 2025 at 2:30 PM      |
+----------------------------------------+
```

### 3. Technical Changes

**File: `src/components/HistorySidebar.tsx`**
- Import `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from UI components
- Add `expandedId` state to track which item is open
- Update `HistoryItem` interface with new fields
- Update Supabase query to fetch all relevant columns
- Add click handler to toggle expansion
- Render detail content inside CollapsibleContent
- Animate the chevron rotation (180 degrees when open)

### 4. Detail Section Content
When expanded, show:
- **Message Section**: The secret message with a label (show "No message" if null)
- **Metrics Grid**: PSNR and SSIM values in a 2-column layout
- **Image Previews**: Clickable thumbnails if URLs exist
- **Timestamp**: Full formatted date and time
