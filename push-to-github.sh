#!/bin/bash

# Cruzza App - Push to GitHub Script
# This script pushes all the bug fixes to the GitHub repository

echo "=== Cruzza App - Pushing to GitHub ==="
echo ""

# Initialize git if not already done
if [ ! -d ".git" ]; then
  echo "Initializing git repository..."
  git init
  git branch -M main
  git remote add origin https://github.com/Naamapp/cruzza-app.git
fi

# Configure git user (change these if needed)
git config user.email "naamapp@cruzza.app"
git config user.name "Cruzza Team"

echo "Staging all changes..."
git add .

echo "Creating commit..."
git commit -m "Fix: Resolve crash when booking ride

- Changed .single() to .maybeSingle() in auth queries to prevent errors
- Added automatic user record creation on sign-in
- Improved error handling in ride booking flow
- Applied database migrations with all required tables
- Fixed context import paths
- Added user validation before ride creation
- Added .gitignore for proper file exclusions"

echo "Pushing to GitHub..."
git push -u origin main

echo ""
echo "=== Push Complete! ==="
echo "Visit: https://github.com/Naamapp/cruzza-app"
