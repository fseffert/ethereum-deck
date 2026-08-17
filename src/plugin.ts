import streamDeck from "@elgato/streamdeck";

import { EthPrice } from "./actions/eth-price";
import { GasEstimate } from "./actions/gas-estimate";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel("trace");

// Register the ETH price action.
streamDeck.actions.registerAction(new EthPrice());
streamDeck.actions.registerAction(new GasEstimate());

// Finally, connect to the Stream Deck.
streamDeck.connect();
