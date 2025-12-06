# Background Image Upload Feature

## Task Specification

Extend the existing counter test application to demonstrate blob upload and display functionality:
- Allow users to upload a background image
- Display the background image behind the counter if defined
- Extend the existing client/server setup

## High-Level Decisions

1. **Separate table for background images**: Created `user_background_images` table instead of adding column to `user_counters` to keep concerns separated
2. **Multipart form data upload**: Used native FormData API with fetch for file uploads (TrailBase supports multipart/form-data POST requests)
3. **Client-side image processing**: Implemented WebP conversion and resizing using Canvas API to ensure files are under 1MB before upload
4. **Background display**: Used CSS `::before` pseudo-element with CSS variables to display background image behind container content with 30% opacity
5. **Replace-only functionality**: Only supports replacing existing background image, no delete/clear option

## Requirements Changes

- Initial requirement: Upload and display background images
- Clarified: Separate table, multipart upload, WebP conversion, max 1MB, replace-only

## Files Modified

**New Files:**
- `server/template/migrations/U1764979880__create_user_background_images.sql` - Migration creating `user_background_images` table with `background_image` column using `std.FileUpload` schema

**Modified Files:**
- `client/src/app.ts` - Added:
  - Image processing utilities (`convertImageToWebP`) for WebP conversion and resizing to max 1MB
  - Background image loading (`loadBackgroundImage`) to fetch and display existing images
  - Background image upload (`uploadBackgroundImage`) using multipart form data
  - Integration with authentication flow to load images on login
- `client/index.html` - Added:
  - File input for background image selection
  - Upload button for background images
  - Styling for image upload section
  - Container styling with `::before` pseudo-element for background image display
  - Text shadow on counter display for better visibility over background

## Rationales and Alternatives

1. **Separate table vs. column in user_counters**: Chose separate table to maintain separation of concerns and allow for future expansion of user settings/images
2. **Canvas API for image processing**: Used native browser Canvas API instead of external libraries to avoid dependencies and keep bundle size small
3. **CSS ::before pseudo-element**: Used for background image display to ensure proper layering (background behind content) and maintain semantic HTML structure
4. **Progressive resizing strategy**: First reduces quality, then dimensions to ensure file size stays under 1MB while maintaining reasonable image quality
5. **Multipart form data**: Used native FormData and fetch instead of TrailBase client library's create method since client library doesn't have built-in multipart support

## Obstacles and Solutions

1. **TrailBase TypeScript client doesn't support multipart uploads directly**: Solution - Used native fetch API with FormData for multipart uploads
2. **Background image needs to be behind content but CSS background-image on container affects all children**: Solution - Used `::before` pseudo-element with absolute positioning and z-index layering
3. **Image file size constraint (1MB)**: Solution - Implemented progressive resizing algorithm that reduces quality first, then dimensions until file size is acceptable

## Current Status

Implementation complete. Features:
- ✅ Migration created for `user_background_images` table
- ✅ Client-side image processing (WebP conversion, resize to 1MB)
- ✅ Multipart form data upload functionality
- ✅ Background image loading and display
- ✅ UI for file selection and upload
- ✅ Background image displayed behind counter container with proper styling
