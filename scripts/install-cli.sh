#!/bin/bash
# Install CLI wrapper for Rosetta on macOS/Linux

set -e

# Fix working directory if it's inaccessible
cd / 2>/dev/null || true

# Detect OS
OS=$(uname -s)
ARCH=$(uname -m)

case "$OS" in
  Darwin)
    # macOS - determine app location from script path
    # Script is at: /path/to/Rosetta.app/Contents/Resources/app/scripts/install-cli.sh
    SCRIPT_PATH="$0"
    # Resolve to absolute path without cd
    if [[ "$SCRIPT_PATH" != /* ]]; then
      SCRIPT_PATH="$PWD/$SCRIPT_PATH"
    fi
    SCRIPT_DIR="$(dirname "$SCRIPT_PATH")"
    APP_ROOT="$(dirname "$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")")"
    APP_LAUNCHER="$APP_ROOT/Contents/MacOS/launcher"
    CLI_NAME="rosetta"
    INSTALL_DIR="/usr/local/bin"

    # Debug: show what we found
    # echo "Script path: $SCRIPT_PATH"
    # echo "App root: $APP_ROOT"
    # echo "Launcher: $APP_LAUNCHER"

    if [ ! -f "$APP_LAUNCHER" ]; then
      echo "Error: Rosetta app not found at $APP_LAUNCHER"
      echo "Please verify the Rosetta.app installation"
      exit 1
    fi

    # Create wrapper script
    WRAPPER=$(mktemp)
    cat > "$WRAPPER" << EOF
#!/bin/bash
exec "$APP_ROOT/Contents/MacOS/bun" "$APP_ROOT/Contents/Resources/app/bun/index.js" "\$@"
EOF
    chmod +x "$WRAPPER"

    # Install with sudo if needed
    if [ -w "$INSTALL_DIR" ]; then
      mv "$WRAPPER" "$INSTALL_DIR/$CLI_NAME"
      echo "✓ Installed $CLI_NAME to $INSTALL_DIR/$CLI_NAME"
    else
      # Use osascript to prompt for password with GUI dialog
      PASSWORD=$(osascript -e 'tell app "System Events" to display dialog "Enter your password to install the CLI:" default answer "" with hidden answer' -e 'text returned of result' 2>/dev/null)
      if [ $? -eq 0 ] && [ -n "$PASSWORD" ]; then
        echo "$PASSWORD" | sudo -S mv "$WRAPPER" "$INSTALL_DIR/$CLI_NAME"
        if [ $? -eq 0 ]; then
          echo "✓ Installed $CLI_NAME to $INSTALL_DIR/$CLI_NAME (with sudo)"
        else
          echo "✗ Failed to move file to $INSTALL_DIR (password may be incorrect)"
          exit 1
        fi
      else
        echo "✗ Installation cancelled"
        rm "$WRAPPER"
        exit 1
      fi
    fi

    echo ""
    echo "You can now use: rosetta stats, rosetta missing, rosetta complete"
    ;;

  Linux)
    # Linux - find where the app is installed
    if [ -f "/opt/rosetta/Rosetta" ]; then
      APP_PATH="/opt/rosetta/Rosetta"
    elif [ -f "$HOME/.local/share/applications/Rosetta" ]; then
      APP_PATH="$HOME/.local/share/applications/Rosetta"
    else
      echo "Error: Rosetta app not found in standard locations"
      echo "Searched: /opt/rosetta, $HOME/.local/share/applications"
      exit 1
    fi

    CLI_NAME="rosetta"
    INSTALL_DIR="/usr/local/bin"

    # Create wrapper script
    WRAPPER=$(mktemp)
    cat > "$WRAPPER" << EOF
#!/bin/bash
exec "$APP_PATH" "\$@"
EOF
    chmod +x "$WRAPPER"

    # Install with sudo if needed
    if [ -w "$INSTALL_DIR" ]; then
      mv "$WRAPPER" "$INSTALL_DIR/$CLI_NAME"
      echo "✓ Installed $CLI_NAME to $INSTALL_DIR/$CLI_NAME"
    else
      sudo mv "$WRAPPER" "$INSTALL_DIR/$CLI_NAME"
      echo "✓ Installed $CLI_NAME to $INSTALL_DIR/$CLI_NAME (with sudo)"
    fi

    echo ""
    echo "You can now use: rosetta stats, rosetta missing, rosetta complete"
    ;;

  MINGW*|MSYS*|CYGWIN*)
    # Windows
    echo "Windows CLI installation not yet implemented"
    echo "For now, use: rosetta.exe stats, rosetta.exe missing, rosetta.exe complete"
    exit 1
    ;;

  *)
    echo "Unsupported OS: $OS"
    exit 1
    ;;
esac
