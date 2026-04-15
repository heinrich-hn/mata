#!/usr/bin/env python3

import os
import re
import subprocess
from pathlib import Path
from collections import defaultdict

SRC_DIR = Path("src")
EXCLUDE_DIRS = {"node_modules", "dist", "build", ".git"}
ALWAYS_KEEP = {"main.tsx", "App.tsx", "index.css", "App.css", "vite-env.d.ts"}

def find_source_files():
    """Find all TypeScript/JavaScript files in src directory"""
    extensions = {".ts", ".tsx", ".js", ".jsx"}
    files = []
    
    for ext in extensions:
        files.extend(SRC_DIR.rglob(f"*{ext}"))
    
    return [f for f in files if not any(excl in f.parts for excl in EXCLUDE_DIRS)]

def get_import_patterns(filename):
    """Generate patterns to search for file usage"""
    name = filename.stem
    
    patterns = [
        f"from ['\"`].*{name}['\"`]",
        f"import.*{name}",
        f"require\\(.*{name}\\)",
        f"import\\(.*{name}\\)",
        f"/{name}['\"`]",
        f"<{name}[\\s/>]"  # JSX component usage
    ]
    
    return patterns

def is_file_used(filepath):
    """Check if a file is imported or used anywhere"""
    if filepath.name in ALWAYS_KEEP:
        return True
    
    if filepath.stem == "index":
        return True
    
    patterns = get_import_patterns(filepath)
    
    for pattern in patterns:
        try:
            # Use ripgrep if available (much faster)
            cmd = ["rg", "-l", "--type", "ts", pattern, str(SRC_DIR)]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                # Check if the only match is the file itself
                matches = result.stdout.strip().split('\n')
                if len(matches) > 1 or (len(matches) == 1 and matches[0] != str(filepath)):
                    return True
        except FileNotFoundError:
            # Fall back to grep
            try:
                cmd = ["grep", "-r", "--include=*.{ts,tsx,js,jsx}", "-l", pattern, str(SRC_DIR)]
                result = subprocess.run(cmd, capture_output=True, text=True)
                
                if result.returncode == 0:
                    matches = result.stdout.strip().split('\n')
                    if len(matches) > 1 or (len(matches) == 1 and matches[0] != str(filepath)):
                        return True
            except:
                pass
    
    return False

def analyze_file(filepath):
    """Get additional file information"""
    try:
        with open(filepath, 'r') as f:
            content = f.read()
            lines = len(content.split('\n'))
            has_export = bool(re.search(r'export\s+(default\s+)?(function|const|class|interface|type|enum)', content))
            return {"lines": lines, "has_export": has_export}
    except:
        return None

def main():
    print("🔍 Scanning for unused files in src directory...\n")
    
    files = find_source_files()
    print(f"Found {len(files)} TypeScript/JavaScript files\n")
    
    unused_files = []
    
    for i, filepath in enumerate(files):
        if (i + 1) % 50 == 0:
            print(f"Progress: {i + 1}/{len(files)} files checked...")
        
        rel_path = filepath.relative_to(SRC_DIR)
        
        if not is_file_used(filepath):
            info = analyze_file(filepath)
            unused_files.append({
                "path": rel_path,
                "info": info
            })
    
    # Output results
    print(f"\n📊 Analysis Results:\n")
    
    if not unused_files:
        print("✅ No unused files found!")
        return
    
    print(f"⚠️  Found {len(unused_files)} potentially unused files:\n")
    
    # Group by directory
    by_dir = defaultdict(list)
    for file in unused_files:
        by_dir[file["path"].parent].append(file)
    
    for directory in sorted(by_dir.keys()):
        print(f"📁 {directory}/")
        for file in sorted(by_dir[directory], key=lambda x: x["path"].name):
            info = file["info"]
            info_str = ""
            if info:
                info_str = f" [{info['lines']} lines, {'exports' if info['has_export'] else 'no exports'}]"
            print(f"   📄 {file['path'].name}{info_str}")
        print()
    
    # Write output files
    with open("unused-files-list.txt", "w") as f:
        for file in unused_files:
            f.write(f"{file['path']}\n")
    
    # Create deletion script
    with open("delete-unused-files.sh", "w") as f:
        f.write("#!/bin/bash\n")
        f.write(f"# Will delete {len(unused_files)} files\n")
        f.write('echo "This will delete unused files. Review unused-files-list.txt first!"\n')
        f.write('read -p "Continue? (yes/no): " confirm\n')
        f.write('if [ "$confirm" != "yes" ]; then exit 1; fi\n\n')
        for file in unused_files:
            f.write(f'rm "src/{file["path"]}"\n')
    
    os.chmod("delete-unused-files.sh", 0o755)
    
    print("📝 Created unused-files-list.txt")
    print("📝 Created delete-unused-files.sh (executable)")
    print("\n💡 Important: Review the list carefully before deleting!")
    print("• Some files may be used through dynamic imports")
    print("• Check for references in CSS, HTML, or config files")
    print("• Run your build process to verify no errors\n")

if __name__ == "__main__":
    main()