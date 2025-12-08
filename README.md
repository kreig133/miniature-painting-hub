# Color Palette Picker

A web application for extracting colors from images and managing paint color collections.

## Setup & Running

### Quick Start with Local Server

Due to CORS restrictions, ES6 modules require a web server. The easiest way is to use Python's built-in server:

```bash
# Navigate to project directory
cd /Users/eduardshangareev/Documents/cursor_colours

# Start local server
python3 -m http.server 8000
```

Then open your browser and navigate to:
```
http://localhost:8000
```

### Alternative Server Options

**Using Node.js (if installed):**
```bash
npx http-server -p 8000
```

**Using PHP (if installed):**
```bash
php -S localhost:8000
```

**Using VS Code Live Server:**
1. Install "Live Server" extension
2. Right-click on `index.html`
3. Select "Open with Live Server"

## Project Structure

```
cursor_colours/
├── js/
│   ├── core/
│   │   └── state.js              # Application state management
│   ├── utils/
│   │   ├── colorUtils.js         # Color conversion utilities
│   │   ├── storage.js            # LocalStorage operations
│   │   └── domUtils.js           # DOM helper functions
│   ├── features/
│   │   ├── palette.js            # Palette management
│   │   ├── imagePicker.js        # Image upload and color picking
│   │   ├── myCollection.js       # My Collection management
│   │   ├── paintColors.js        # Paint colors data and display
│   │   ├── planning.js           # Planning table and color matching
│   │   ├── filters.js            # Filter system
│   │   └── colorWheel.js         # Color wheel rendering
│   ├── ui/
│   │   ├── tabs.js               # Tab switching
│   │   └── modals.js             # Modal management
│   └── main.js                   # Application initialization
├── data/
│   ├── vallejo_model_colours_data.js
│   ├── vallejo_model_air_colours_data.js
│   ├── vallejo_game_color_data.js
│   ├── army_painter_speedpaint_2.0_data.js
│   ├── army_painter_warpaints_fanatic_data.js
│   ├── ak_interactive_3gen_data.js
│   └── ak_interactive_quick_gen_data.js
├── index.html
├── styles.css
└── script.js (legacy - can be removed after testing)

```

## Features

- **Image Color Picker**: Upload an image and click to extract colors
- **Palette Management**: Save and organize colors in your palette
- **Paint Colors Database**: Browse paint colors from multiple manufacturers
- **My Collection**: Manage your personal paint collection
- **Planning Table**: Find matching paint colors for your palette
- **Color Wheels**: Visual representation of colors in HSV space
- **Filters**: Filter by producer and type
- **Custom Colors**: Add your own colors to My Collection

## Browser Compatibility

Requires a modern browser that supports:
- ES6 Modules
- Canvas API
- LocalStorage
- FileReader API

Tested on: Chrome, Firefox, Safari, Edge (latest versions)

