const kv = await Deno.openKv();

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

function withCors(headers = {}) {
	return { ...corsHeaders, ...headers };
}

function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: withCors({ "Content-Type": "application/json" }),
	});
}

function textResponse(body, status) {
	return new Response(body, { status, headers: withCors() });
}

/* --------------------------------------------------------------------------------------------------
State Management (existing functionality)
---------------------------------------------------------------------------------------------------*/

async function getState(tableId) {
	const entry = await kv.get(["table", tableId]);
	return entry.value ?? null;
}

async function saveState(tableId, payload) {
	const current = await getState(tableId);
	const version = (current?.version ?? 0) + 1;
	const record = {
		state: payload.state,
		notifications: payload.notifications ?? current?.notifications ?? [],
		updatedAt: new Date().toISOString(),
		version,
	};
	await kv.set(["table", tableId], record, { expireIn: 86_400_000 });
	return record;
}

async function handleStatePost(request) {
	let data;
	try {
		data = await request.json();
	} catch {
		return textResponse("Invalid JSON", 400);
	}

	const state = data?.state;
	if (state === undefined) {
		return textResponse("Missing state", 400);
	}

	const tableId = data.tableId || "default";
	const record = await saveState(tableId, {
		state,
		notifications: data.notifications,
	});
	return jsonResponse({
		ok: true,
		version: record.version,
		updatedAt: record.updatedAt,
	});
}

async function handleStateGet(url) {
	const tableId = url.searchParams.get("tableId") || "default";
	const sinceParam = url.searchParams.get("sinceVersion");
	const sinceVersion = sinceParam ? Number.parseInt(sinceParam, 10) : 0;
	const record = await getState(tableId);
	if (!record) {
		return textResponse("Not found", 404);
	}
	if (!Number.isNaN(sinceVersion) && record.version <= sinceVersion) {
		return new Response(null, { status: 204, headers: withCors() });
	}
	return jsonResponse(record);
}

/* --------------------------------------------------------------------------------------------------
Player Action Management (new functionality for phone controls)
---------------------------------------------------------------------------------------------------*/

async function getAction(tableId, seatIndex) {
	const entry = await kv.get(["action", tableId, seatIndex]);
	return entry.value ?? null;
}

async function saveAction(tableId, seatIndex, action) {
	const record = {
		action: action.action, // "fold", "check", "call", "raise", "allin"
		amount: action.amount ?? 0,
		timestamp: Date.now(),
	};
	// Actions expire after 5 minutes (should be consumed much faster)
	await kv.set(["action", tableId, seatIndex], record, { expireIn: 300_000 });
	return record;
}

async function deleteAction(tableId, seatIndex) {
	await kv.delete(["action", tableId, seatIndex]);
}

async function handleActionPost(request) {
	let data;
	try {
		data = await request.json();
	} catch {
		return textResponse("Invalid JSON", 400);
	}

	const { tableId, seatIndex, action, amount } = data;

	if (!tableId) {
		return textResponse("Missing tableId", 400);
	}
	if (typeof seatIndex !== "number") {
		return textResponse("Missing or invalid seatIndex", 400);
	}
	if (!action || !["fold", "check", "call", "raise", "allin"].includes(action)) {
		return textResponse("Missing or invalid action", 400);
	}

	const record = await saveAction(tableId, seatIndex, { action, amount });
	return jsonResponse({
		ok: true,
		action: record.action,
		amount: record.amount,
		timestamp: record.timestamp,
	});
}

async function handleActionGet(url) {
	const tableId = url.searchParams.get("tableId");
	const seatIndexParam = url.searchParams.get("seatIndex");

	if (!tableId) {
		return textResponse("Missing tableId", 400);
	}
	if (!seatIndexParam) {
		return textResponse("Missing seatIndex", 400);
	}

	const seatIndex = Number.parseInt(seatIndexParam, 10);
	if (Number.isNaN(seatIndex)) {
		return textResponse("Invalid seatIndex", 400);
	}

	const record = await getAction(tableId, seatIndex);
	if (!record) {
		return new Response(null, { status: 204, headers: withCors() });
	}
	return jsonResponse(record);
}

async function handleActionDelete(url) {
	const tableId = url.searchParams.get("tableId");
	const seatIndexParam = url.searchParams.get("seatIndex");

	if (!tableId) {
		return textResponse("Missing tableId", 400);
	}
	if (!seatIndexParam) {
		return textResponse("Missing seatIndex", 400);
	}

	const seatIndex = Number.parseInt(seatIndexParam, 10);
	if (Number.isNaN(seatIndex)) {
		return textResponse("Invalid seatIndex", 400);
	}

	await deleteAction(tableId, seatIndex);
	return jsonResponse({ ok: true });
}

/* --------------------------------------------------------------------------------------------------
Request Routing
---------------------------------------------------------------------------------------------------*/

function handleOptions() {
	return new Response(null, { status: 204, headers: withCors() });
}

function routeRequest(request) {
	const url = new URL(request.url);
	const pathname = url.pathname;

	// Handle CORS preflight for all endpoints
	if (request.method === "OPTIONS") {
		return handleOptions();
	}

	// Route: /state (existing functionality)
	if (pathname === "/state") {
		if (request.method === "GET") {
			return handleStateGet(url);
		}
		if (request.method === "POST") {
			return handleStatePost(request);
		}
		return textResponse("Method not allowed", 405);
	}

	// Route: /action (new functionality for phone controls)
	if (pathname === "/action") {
		if (request.method === "GET") {
			return handleActionGet(url);
		}
		if (request.method === "POST") {
			return handleActionPost(request);
		}
		if (request.method === "DELETE") {
			return handleActionDelete(url);
		}
		return textResponse("Method not allowed", 405);
	}

	return textResponse("Not found", 404);
}

Deno.serve(async (request) => {
	try {
		return await routeRequest(request);
	} catch (error) {
		console.error("Unexpected error", error);
		return textResponse("Internal error", 500);
	}
});
