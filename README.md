# Ethereum Deck

Ethereum Deck is an Elgato Stream Deck plugin that keeps useful Ethereum market information visible on a Stream Deck key. It provides live ETH price and network gas-price actions without requiring a browser to remain open.

## Features

### ETH Price

- Displays the current Ethereum price on a Stream Deck key.
- Supports **USD** and **EUR**, selectable in the action's settings.
- Refreshes automatically every 2.5 minutes.
- Refreshes the displayed value when the key is pressed.

### Gas Price

- Displays the current Ethereum gas price in **gwei**.
- Supports **Safe**, **Proposed**, and **Fast** estimates, selectable in the action's settings.
- Refreshes automatically every 5 minutes.
- Refreshes the displayed value when the key is pressed, subject to the API's five-minute request cooldown.

If a request fails, the plugin keeps the last displayed value and shows an alert on the key.

## Requirements

- Elgato Stream Deck software 7.1 or newer
- Windows 10 or newer, or macOS 12 or newer
- Network access to the configured Ethereum Deck API

For development, Node.js 24 and npm are expected.

## Using the Plugin

1. Open the Stream Deck application.
2. Find **Ethereum Deck** in the actions list.
3. Drag **Price** or **Gas Price** onto a Stream Deck key.
4. Select the key and configure its currency or gas-price speed in the property inspector.
5. Press the key whenever you want to refresh the displayed value manually.

## Development

Install the dependencies and create a production build:

```sh
npm install
npm run build
```

The generated plugin code is written to `com.florian-seffert.ethereum-deck.sdPlugin/bin/plugin.js`.

Link the plugin to the local Stream Deck installation and start watch mode:

```sh
npx streamdeck link com.florian-seffert.ethereum-deck.sdPlugin
npm run watch
```

Watch mode rebuilds the plugin and restarts `com.florian-seffert.ethereum-deck` after changes.

To validate or package the plugin, run:

```sh
npx streamdeck validate com.florian-seffert.ethereum-deck.sdPlugin
npx streamdeck pack com.florian-seffert.ethereum-deck.sdPlugin
```

## Data Source

The plugin obtains ETH prices and gas estimates from the Ethereum Deck API endpoints configured in `src/actions/eth-price.ts` and `src/actions/gas-estimate.ts`. No wallet connection, private key, or transaction signing is involved.
