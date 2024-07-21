const crypto = require('crypto');

const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET;
const stakingCurrencies = ['SOL', 'AVAX', 'TRX'];

function signRequest(apiSecret, timestamp, verb, path, body = '') {
    return crypto
        .createHmac("sha512", apiSecret)
        .update(timestamp.toString())
        .update(verb.toUpperCase())
        .update(path)
        .update(body)
        .digest("hex");
}

function getHeaders(timestamp, verb, path, body = '') {
    return {
        "Content-type": "application/json; charset=UTF-8",
        "X-VALR-API-KEY": `${apiKey}`,
        "X-VALR-SIGNATURE": `${signRequest(apiSecret, timestamp, verb, path, body)}`,
        "X-VALR-TIMESTAMP": `${timestamp}`
    };
}

function stake(currency, amount) {
    console.log(`Staking ${amount} ${currency}`);
    let timestamp = (new Date()).getTime();
    const body = `{"currencySymbol":"${currency}","amount":"${amount}"}`;
    const options = {
        method: "POST",
        body: body,
        headers: getHeaders(timestamp, "POST", "/v1/staking/stake", body)
    };
    return fetch('https://api.valr.com/v1/staking/stake', options);
}

async function getCurrencies() {
    let timestamp = (new Date()).getTime();
    let options = {
        method: "GET",
        headers: getHeaders(timestamp, "GET", "/v1/public/currencies"),
    };
    const response = await fetch('https://api.valr.com/v1/public/currencies', options);
    const json = await response.json();
    return json.filter(currency => stakingCurrencies.includes(currency.shortName));
}

const stakeAll = async () => {
    try {
        const currencies = await getCurrencies();
        let timestamp = (new Date()).getTime();
        let options = {
            method: "GET",
            headers: getHeaders(timestamp, "GET", "/v1/account/balances?excludeZeroBalances=true"),
        };
        const response = await fetch('https://api.valr.com/v1/account/balances?excludeZeroBalances=true', options);
        const json = await response.json();
        const filteredBalances = json.filter(balance => stakingCurrencies.includes(balance.currency));

        const stakePromises = filteredBalances.map(async (balance) => {
            const currencyDecimalPlaces = currencies.find(currency => currency.shortName === balance.currency).withdrawalDecimalPlaces;
            const available = `${balance.available}`;
            const toStake = available.substring(0, available.indexOf('.') + Number(currencyDecimalPlaces) + 1);
            if (Number(toStake) > 0) {
                await stake(balance.currency, toStake);
            } else {
                console.log(`Insufficient balance to stake: ${available} ${balance.currency}`);
            }
        });

        await Promise.all(stakePromises);
    } catch (error) {
        console.log(error);
    }
};

if (require.main === module) {
    // This code will only run if the file is executed directly with Node.js
    stakeAll().catch(error => {
        console.error('Error occurred while running stakeAll:', error);
        process.exit(1); // Exit with a non-zero status code to indicate an error
    });
}

module.exports = stakeAll;
