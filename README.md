# LinkedIn Cleaner

A Chrome extension that helps you maintain a cleaner, more focused LinkedIn feed by automatically hiding distracting content.
Please note: all code here is AI generated (including this README (but paradoxically not this line of text))

## Features

- 🚫 **Long Document Blocking**: Automatically hides posts with more than 3 pages/slides
- 😊 **Emoji Control**: Blocks posts that use excessive emoji bullet points
- 👀 **Show Anyway**: Each hidden post can be revealed with a single click
- 🎨 **Native Design**: Seamlessly integrates with LinkedIn's interface
- 🔒 **Privacy First**: Works entirely locally - no data collection or external services

## How It Works

The extension monitors your LinkedIn feed and automatically hides:
1. Documents/slideshows with more than 3 pages
2. Posts that use 2 or more different emoji bullet points

When content is hidden, you'll see:
- A clean placeholder showing why the post was hidden
- The author's name
- A "Show Anyway" button to reveal the content if desired

## Installation

### From Chrome Web Store
1. Visit the [LinkedIn Cleaner](chrome_web_store_link) page
2. Click "Add to Chrome"
3. Confirm the installation

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the extension directory

## Privacy

LinkedIn Cleaner respects your privacy:
- No data collection
- No external services
- All processing happens locally in your browser
- Only runs on LinkedIn feed pages
- Minimal permissions required

## Permissions

The extension requires only necessary permissions:
- `storage`: To remember which posts have been processed
- `https://www.linkedin.com/feed/*`: To operate on LinkedIn feed pages only

## Development

### Project Structure
```
linkedin_cleaner/
├── manifest.json     # Extension configuration
├── content.js       # Main functionality
└── icons/           # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Local Development
1. Make changes to the code
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes on LinkedIn

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

[MIT](LICENSE)

## Support

If you encounter any issues or have suggestions:
1. Check existing [issues](github_issues_link)
2. Open a new issue if needed
3. Include specific examples and screenshots when possible

## Acknowledgments

- Thanks to LinkedIn for providing CSS variables that allow seamless style integration
- Built with Chrome Extensions Manifest V3 