// Get elements
const accountBalance = document.getElementById("account-balance");
const accountCurrency = document.getElementById("account-currency");
const iframeContainer = document.getElementById("iframe-container");
const derivBotIframe = document.getElementById("deriv-bot-iframe");

const app_id = '68001'; // Replace with your app ID
let ws;
let heartbeatInterval;
const HEARTBEAT_INTERVAL = 30000;

// Initialize WebSocket connection
const connectWebSocket = () => {
    ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${app_id}`);

    ws.onopen = () => {
        console.log("WebSocket connected.");
        startHeartbeat();
        const token = localStorage.getItem("deriv_token");
        if (token) authorize(token);
    };

    ws.onmessage = (message) => {
        const response = JSON.parse(message.data);
        handleApiResponse(response);
    };

    ws.onclose = () => {
        console.warn("WebSocket closed. Reconnecting...");
        stopHeartbeat();
        setTimeout(connectWebSocket, 1000);
    };

    ws.onerror = (error) => console.error("WebSocket error:", error);
};

// Start Heartbeat
const startHeartbeat = () => {
    heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ ping: 1 }));
            console.log("Heartbeat ping sent.");
        }
    }, HEARTBEAT_INTERVAL);
};

const stopHeartbeat = () => {
    clearInterval(heartbeatInterval);
};

// Authorize the user
const authorize = (token) => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ authorize: token }));
        console.log("Authorization request sent.");
    }
};

// Handle WebSocket Responses
const handleApiResponse = (response) => {
    console.log("Response received:", response);

    if (response.msg_type === "authorize") {
        console.log("Authorization successful.");
        const userToken = response.authorize.token;
        localStorage.setItem("deriv_token", userToken); // Save user's token

        const accountType = response.echo_req.account_type || "real";
        getBalanceForAccount(accountType);

        // Display Deriv Bot iframe with user's token
        displayDerivBotIframe(userToken);
    } else if (response.msg_type === "balance") {
        if (response.balance) {
            const { balance, currency } = response.balance;

            // Update UI
            accountBalance.textContent = `Balance: ${balance}`;
            accountCurrency.textContent = `${currency}`;
        } else if (response.error) {
            console.error("Error:", response.error.message);
            alert(`Error: ${response.error.message}`);
        }
    }
};

// Fetch Account Balance
const getBalanceForAccount = (accountType) => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(
            JSON.stringify({
                balance: 1,
            })
        );
        console.log(`Balance request sent for ${accountType} account.`);
    }
};

// Display the Deriv Bot iframe
const displayDerivBotIframe = (token) => {
    iframeContainer.style.display = "block";
    derivBotIframe.src = `https://app.deriv.com/bot?token=${token}`; // Use user's token
};

// Initialize on window load
window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token1");
    const redirect_uri = encodeURIComponent(window.location.origin + "/dashboard.html");

    if (token) {
        // Store the token in localStorage
        localStorage.setItem("deriv_token", token);

        // Redirect the user to the dashboard (without the token in the URL)
        window.history.replaceState({}, document.title, window.location.pathname);

        // Authorize the user using the token
        authorize(token);
    } else {
        // Check if the token is already stored
        const storedToken = localStorage.getItem("deriv_token");
        if (storedToken) {
            authorize(storedToken);
        } else {
            console.error("Token is missing. Please log in.");
            window.location.href = `https://oauth.deriv.com/oauth2/authorize?app_id=${app_id}&scope=read&redirect_uri=${redirect_uri}`;
        }
    }
};

// Establish WebSocket connection
connectWebSocket();
