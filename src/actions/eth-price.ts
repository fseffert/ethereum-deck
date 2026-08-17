import streamDeck, {
	action,
	DidReceiveSettingsEvent,
	KeyAction,
	KeyDownEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";

const PRICE_URL = "http://ethdeck.dekanhort.internal/api/v1/eth-price";
const REFRESH_INTERVAL_MS = 150_000;

type Currency = "USD" | "EUR";

type PriceSettings = {
	currency?: Currency;
};

type PriceResponse = {
	coinmarketcap_id: number;
	symbol: string;
	price_usd: string;
	price_eur: string;
	source: string;
};

/** Displays the current ETH price in the configured currency. */
@action({ UUID: "com.florian-seffert.ethereum-deck.increment" })
export class EthPrice extends SingletonAction<PriceSettings> {
	private readonly refreshTimers = new Map<string, NodeJS.Timeout>();
	private readonly currencies = new Map<string, Currency>();
	private cachedPrice?: PriceResponse;
	private cachedAt = 0;
	private priceRequest?: Promise<PriceResponse>;

	override async onWillAppear(ev: WillAppearEvent<PriceSettings>): Promise<void> {
		if (!ev.action.isKey()) {
			return;
		}

		const currency = ev.payload.settings.currency ?? "USD";
		this.currencies.set(ev.action.id, currency);

		if (!ev.payload.settings.currency) {
			await ev.action.setSettings({ ...ev.payload.settings, currency: "USD" });
		}

		await this.refresh(ev.action, currency);
		this.startRefreshTimer(ev.action);
	}

	override onWillDisappear(ev: WillDisappearEvent<PriceSettings>): void {
		this.stopRefreshTimer(ev.action.id);
		this.currencies.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<PriceSettings>): Promise<void> {
		if (!ev.action.isKey()) {
			return;
		}

		const currency = ev.payload.settings.currency ?? "USD";
		const previousCurrency = this.currencies.get(ev.action.id);
		this.currencies.set(ev.action.id, currency);

		if (currency !== previousCurrency) {
			await this.refresh(ev.action, currency);
		}
	}

	override async onKeyDown(ev: KeyDownEvent<PriceSettings>): Promise<void> {
		await this.refresh(ev.action, this.currencies.get(ev.action.id) ?? "USD");
	}

	private startRefreshTimer(action: KeyAction<PriceSettings>): void {
		this.stopRefreshTimer(action.id);
		const timer = setInterval(
			() => void this.refresh(action, this.currencies.get(action.id) ?? "USD"),
			REFRESH_INTERVAL_MS,
		);
		this.refreshTimers.set(action.id, timer);
	}

	private stopRefreshTimer(actionId: string): void {
		const timer = this.refreshTimers.get(actionId);
		if (timer) {
			clearInterval(timer);
			this.refreshTimers.delete(actionId);
		}
	}

	private async refresh(action: KeyAction<PriceSettings>, currency: Currency): Promise<void> {
		try {
			const price = await this.getPrice();
			const value = currency === "EUR" ? price.price_eur : price.price_usd;
			const numericValue = Number(value);
			if (!Number.isFinite(numericValue)) {
				throw new Error(`Price API returned an invalid ${currency} price`);
			}

			await action.setTitle(`\n\n\n${this.formatPrice(numericValue, currency)}`);
		} catch (error) {
			streamDeck.logger.warn("Unable to refresh the ETH price; keeping the last displayed value.", error);
			await action.showAlert();
		}
	}

	private async getPrice(): Promise<PriceResponse> {
		if (this.cachedPrice && Date.now() - this.cachedAt < REFRESH_INTERVAL_MS) {
			return this.cachedPrice;
		}

		if (!this.priceRequest) {
			this.priceRequest = this.fetchPrice().finally(() => {
				this.priceRequest = undefined;
			});
		}

		return this.priceRequest;
	}

	private async fetchPrice(): Promise<PriceResponse> {
		const response = await fetch(PRICE_URL);
		if (!response.ok) {
			throw new Error(`Price API returned HTTP ${response.status}`);
		}

		const price = (await response.json()) as PriceResponse;
		this.cachedPrice = price;
		this.cachedAt = Date.now();
		return price;
	}

	private formatPrice(value: number, currency: Currency): string {
		const formatted = new Intl.NumberFormat(currency === "EUR" ? "de-DE" : "en-US", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(value);

		return currency === "EUR" ? `${formatted}€` : `$${formatted}`;
	}
}
