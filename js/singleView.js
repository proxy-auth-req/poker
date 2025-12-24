/* --------------------------------------------------------------------------------------------------
Imports
---------------------------------------------------------------------------------------------------*/

/* --------------------------------------------------------------------------------------------------
Variables
---------------------------------------------------------------------------------------------------*/
const singleViewEl = document.getElementById("single");
const cardSlots = document.querySelectorAll(".hole-cards img");
const nameBadge = document.querySelector("h3");
const chipsEl = document.querySelector(".total");
const betEl = document.querySelector(".bet");
const potEl = document.querySelector("#pot");
const notificationsEl = document.querySelector("#singleview-notifications");
const onlineOnlyElements = [betEl, potEl, notificationsEl];
const urlParams = new URLSearchParams(globalThis.location.search);
const params = urlParams.get("params") ? urlParams.get("params").split("-") : [];
const tableId = urlParams.get("tableId") || "";
const seatIndexParam = params[4] ? parseInt(params[4], 10) : null;

// Backend endpoints - update these to your own Deno Deploy URL after deployment
const BACKEND_BASE_URL = "https://af-poker-20.deno.dev";
const STATE_ENDPOINT = `${BACKEND_BASE_URL}/state`;
const ACTION_ENDPOINT = `${BACKEND_BASE_URL}/action`;

const REFRESH_INTERVAL = 1500; // Faster polling when we need to detect turn changes
let lastVersion = 0;
let pollTimeoutId = null;
let isPolling = false;

// Action control elements
const phoneActionsSection = document.getElementById("phone-actions");
const actionPrompt = document.getElementById("action-prompt");
const callAmountEl = document.getElementById("call-amount");
const foldButton = document.getElementById("phone-fold-button");
const actionButton = document.getElementById("phone-action-button");
const amountSlider = document.getElementById("phone-amount-slider");
const sliderOutput = document.getElementById("phone-slider-output");
const actionSentEl = document.getElementById("action-sent");

// Track if we've already sent an action this turn
let actionSent = false;
let isMyTurn = false;
let currentActionContext = null;
let playerChips = 0;

/* --------------------------------------------------------------------------------------------------
functions
---------------------------------------------------------------------------------------------------*/

function init() {
	document.addEventListener("touchstart", function () {}, false);
	document.addEventListener("visibilitychange", handleVisibilityChange);
	applyParams();
	setupActionControls();
	pollState();
}

function applyParams() {
	const card1 = params[0];
	const card2 = params[1];
	const playerName = params[2];
	const chipsVal = Number.parseInt(params[3], 10);

	setCards(card1, card2);
	nameBadge.textContent = playerName;
	chipsEl.textContent = chipsVal;
	playerChips = chipsVal;
}

function setCards(card1, card2, folded = false) {
	if (card1) {
		cardSlots[0].src = `cards/${card1}.svg`;
	}
	if (card2) {
		cardSlots[1].src = `cards/${card2}.svg`;
	}
	if (folded) {
		singleViewEl.classList.add("folded");
	} else {
		singleViewEl.classList.remove("folded");
	}
}

function setChips(amount, roundBet, pot) {
	if (typeof amount === "number") {
		chipsEl.textContent = amount;
		playerChips = amount;
	}
	if (typeof roundBet === "number") {
		betEl.textContent = roundBet;
	}
	if (typeof pot === "number") {
		potEl.textContent = pot;
	}
}

function setOnlineElementsVisible(isOnline) {
	onlineOnlyElements.forEach((el) => {
		if (!el) return;
		el.classList.toggle("hidden", !isOnline);
	});
}

function renderNotifications(notifications) {
	notificationsEl.textContent = "";
	for (const message of notifications) {
		const item = document.createElement("div");
		item.textContent = message;
		notificationsEl.appendChild(item);
	}
}

/* --------------------------------------------------------------------------------------------------
Action Controls
---------------------------------------------------------------------------------------------------*/

function setupActionControls() {
	if (!foldButton || !actionButton || !amountSlider) return;
	
	foldButton.addEventListener("click", handleFold);
	actionButton.addEventListener("click", handleAction);
	amountSlider.addEventListener("input", handleSliderInput);
	amountSlider.addEventListener("change", handleSliderChange);
}

function showActionControls(actionContext) {
	if (!phoneActionsSection || !actionContext) return;
	
	currentActionContext = actionContext;
	const { needToCall, minRaise, canCheck, playerChips: chips } = actionContext;
	
	// Update player chips from context
	if (typeof chips === "number") {
		playerChips = chips;
	}
	
	// Configure slider
	if (canCheck && needToCall === 0) {
		// Can check: slider starts at 0
		amountSlider.min = 0;
		amountSlider.value = 0;
		sliderOutput.textContent = 0;
	} else {
		// Must call or raise: slider starts at call amount
		const minBet = Math.min(needToCall, playerChips);
		amountSlider.min = minBet;
		amountSlider.value = minBet;
		sliderOutput.textContent = minBet;
	}
	amountSlider.max = playerChips;
	amountSlider.step = 10;
	
	// Update call amount display
	if (needToCall > 0) {
		callAmountEl.textContent = `Call: ${Math.min(needToCall, playerChips)}`;
		callAmountEl.classList.remove("hidden");
	} else {
		callAmountEl.classList.add("hidden");
	}
	
	// Update button label
	updateActionButtonLabel();
	
	// Show the controls
	actionSentEl.classList.add("hidden");
	phoneActionsSection.classList.remove("hidden");
	actionSent = false;
}

function hideActionControls() {
	if (!phoneActionsSection) return;
	phoneActionsSection.classList.add("hidden");
	isMyTurn = false;
}

function updateActionButtonLabel() {
	if (!currentActionContext) return;
	
	const val = parseInt(amountSlider.value, 10);
	const { needToCall, minRaise } = currentActionContext;
	
	// Check for invalid raise (between call and minRaise)
	const isInvalidRaise = val > needToCall && val < minRaise && val < playerChips;
	if (isInvalidRaise) {
		sliderOutput.classList.add("invalid");
	} else {
		sliderOutput.classList.remove("invalid");
	}
	
	if (val === 0) {
		actionButton.textContent = "Check";
	} else if (val >= playerChips) {
		actionButton.textContent = "All-In";
	} else if (val === needToCall) {
		actionButton.textContent = "Call";
	} else {
		actionButton.textContent = "Raise";
	}
}

function handleSliderInput() {
	sliderOutput.textContent = amountSlider.value;
	updateActionButtonLabel();
}

function handleSliderChange() {
	if (!currentActionContext) return;
	
	const val = parseInt(amountSlider.value, 10);
	const { needToCall, minRaise } = currentActionContext;
	
	// Snap to minRaise if between call and minRaise
	if (val > needToCall && val < minRaise && val < playerChips) {
		const snappedVal = Math.min(minRaise, playerChips);
		amountSlider.value = snappedVal;
		sliderOutput.textContent = snappedVal;
		sliderOutput.classList.remove("invalid");
		updateActionButtonLabel();
	}
}

async function handleFold() {
	if (actionSent) return;
	await sendAction("fold", 0);
}

async function handleAction() {
	if (actionSent || !currentActionContext) return;
	
	const val = parseInt(amountSlider.value, 10);
	const { needToCall } = currentActionContext;
	
	let actionType;
	if (val === 0) {
		actionType = "check";
	} else if (val >= playerChips) {
		actionType = "allin";
	} else if (val === needToCall) {
		actionType = "call";
	} else {
		actionType = "raise";
	}
	
	await sendAction(actionType, val);
}

async function sendAction(action, amount) {
	if (actionSent) return;
	actionSent = true;
	
	// Show confirmation
	foldButton.disabled = true;
	actionButton.disabled = true;
	amountSlider.disabled = true;
	actionSentEl.classList.remove("hidden");
	
	try {
		const response = await fetch(ACTION_ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				tableId,
				seatIndex: seatIndexParam,
				action,
				amount,
			}),
		});
		
		if (!response.ok) {
			console.error("Failed to send action:", await response.text());
			// Reset so player can try again
			actionSent = false;
			foldButton.disabled = false;
			actionButton.disabled = false;
			amountSlider.disabled = false;
			actionSentEl.classList.add("hidden");
		}
	} catch (error) {
		console.error("Error sending action:", error);
		// Reset so player can try again
		actionSent = false;
		foldButton.disabled = false;
		actionButton.disabled = false;
		amountSlider.disabled = false;
		actionSentEl.classList.add("hidden");
	}
}

/* --------------------------------------------------------------------------------------------------
State Polling
---------------------------------------------------------------------------------------------------*/

// Constant polling is intentional.
// Poker tables have bursty activity; 204 does not imply inactivity ahead.
async function pollState() {
	if (isPolling || document.visibilityState !== "visible") {
		return;
	}
	isPolling = true;
	try {
		const url = `${STATE_ENDPOINT}?tableId=${
			encodeURIComponent(tableId)
		}&sinceVersion=${lastVersion}`;
		const res = await fetch(url);
		if (res.status === 204) {
			setOnlineElementsVisible(true);
			return;
		}
		if (res.ok) {
			const payload = await res.json();
			lastVersion = payload.version;
			applyRemoteState(payload);
			setOnlineElementsVisible(true);
		} else {
			setOnlineElementsVisible(false);
		}
	} catch (error) {
		console.warn("state fetch failed", error);
		setOnlineElementsVisible(false);
	} finally {
		isPolling = false;
		schedulePoll();
	}
}

function schedulePoll() {
	if (document.visibilityState !== "visible") {
		pollTimeoutId = null;
		return;
	}
	// Poll faster when it's our turn to catch state changes quickly
	const interval = isMyTurn ? 800 : REFRESH_INTERVAL;
	pollTimeoutId = setTimeout(pollState, interval);
}

function handleVisibilityChange() {
	if (pollTimeoutId !== null) {
		clearTimeout(pollTimeoutId);
		pollTimeoutId = null;
	}
	if (document.visibilityState !== "visible") {
		return;
	}
	if (!isPolling) {
		pollState();
	}
}

function applyRemoteState(payload) {
	if (!payload || !payload.state || !Array.isArray(payload.state.players)) return;
	const player = payload.state.players.find((p) => p.seatIndex === seatIndexParam);
	if (!player) return;
	nameBadge.textContent = player.name;
	const pot = payload.state.pot || 0;

	setCards(player.cards?.[0], player.cards?.[1], player.folded);
	setChips(player.chips, player.roundBet, pot);
	renderNotifications(payload.notifications);
	
	// Check if it's this player's turn
	const { activePlayerSeatIndex, actionContext } = payload.state;
	const wasMyTurn = isMyTurn;
	isMyTurn = activePlayerSeatIndex === seatIndexParam && !player.folded && !player.allIn;
	
	if (isMyTurn && actionContext) {
		// It's our turn - show action controls
		if (!wasMyTurn || !actionSent) {
			// Only reset controls if turn just started or we haven't sent an action
			showActionControls(actionContext);
		}
	} else {
		// Not our turn - hide controls and reset
		hideActionControls();
		actionSent = false;
		foldButton.disabled = false;
		actionButton.disabled = false;
		amountSlider.disabled = false;
	}
}

/* --------------------------------------------------------------------------------------------------
public members, exposed with return statement
---------------------------------------------------------------------------------------------------*/
globalThis.app = {
	init,
};

app.init();
