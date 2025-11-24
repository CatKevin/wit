#!/bin/bash

# Build the project
echo "Building the project..."
npm run build

# Add .nojekyll file to docs folder to prevent Jekyll processing
echo "Adding .nojekyll file..."
touch docs/.nojekyll

# Create a 404.html that redirects to index.html for SPA support
echo "Creating 404.html for SPA routing..."
cp docs/index.html docs/404.html

echo "Build complete! The docs folder is ready for GitHub Pages."
echo ""
echo "To deploy to GitHub Pages:"
echo "1. Commit the docs folder: git add docs && git commit -m 'Update GitHub Pages'"
echo "2. Push to GitHub: git push"
echo "3. In GitHub repository settings, set GitHub Pages source to 'Deploy from a branch' and select '/docs' folder"
echo ""
echo "Your site will be available at: https://[your-username].github.io/[repository-name]/"