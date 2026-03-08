#!/bin/bash
# Install CLI wrapper for Rosetta on macOS/Linux

set -e

# Detect OS
OS=$(uname -s)
ARCH=$(uname -m)

case "$OS" in
  Darwin)
    # macOS
    APP_PATH="/Applications/Rosetta.app/Contents/MacOS/bun"
    SCRIPT_PATH="/Applications/Rosetta.app/Contents/Resources/main.js"
    CLI_NAME="rosetta"
    INSTALL_DIR="/usr/local/bin"

    if [ ! -f "$APP_PATH" ]; then
      echo "Error: Rosetta app not found at $APP_PATH"
      echo "Please install Rosetta.app to /Applications first"
      exit 1
    fi

    # Create wrapper script
    WRAPPER=$(mktemp)
    cat > "$WRAPPER" << 'EOF'
#!/bin/bash
exec "/Applications/Rosetta.app/Contents/MacOS/bun" "/Applications/Rosetta.app/Contents/Resources/main.js" "$@"
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
