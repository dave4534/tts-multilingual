/**
 * Layout constants. Spacing follows UI reference: 25px for standard gaps.
 *
 * State 1 (landing): 25px header→content, 25px voice→text, 25px text→upload, 25px upload→footer, 25px horizontal gutters.
 * State 2 (text loaded): 25px header→voice, 25px voice→text, 25px text→footer, 25px left margin, 100px right gap to sidebar.
 */
export const SPACER_PX = 25;
export const BOTTOM_BAR_HEIGHT_PX = 80;
export const UPLOAD_ZONE_GAP_PX = SPACER_PX;
export const UPLOAD_ZONE_HEIGHT_PX = 270;
export const TEXT_TO_UPLOAD_GAP_PX = SPACER_PX;
export const MAIN_HORIZONTAL_PX = SPACER_PX;
export const TEXT_TO_SIDEBAR_GAP_PX = 100; /* State 2: gap between text block and sidebar */

/** Padding-bottom for main when idle: reserves space so text never scrolls under FileUpload */
export const MAIN_PADDING_BOTTOM_IDLE_PX =
  BOTTOM_BAR_HEIGHT_PX +
  UPLOAD_ZONE_GAP_PX +
  UPLOAD_ZONE_HEIGHT_PX +
  TEXT_TO_UPLOAD_GAP_PX +
  10;

/** FileUpload fixed bottom offset (above BottomBar) */
export const UPLOAD_ZONE_BOTTOM_PX = BOTTOM_BAR_HEIGHT_PX + UPLOAD_ZONE_GAP_PX;

/** Padding-bottom for main when text is shown: 25px gap above BottomBar */
export const MAIN_PADDING_BOTTOM_WITH_TEXT_PX = BOTTOM_BAR_HEIGHT_PX + SPACER_PX;

/** Text area scrollbar container (track) width */
export const SCROLLBAR_WIDTH_PX = 24;
/** Scrollbar thumb width */
export const SCROLLBAR_THUMB_WIDTH_PX = 12;
