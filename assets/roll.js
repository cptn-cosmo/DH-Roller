let trackedIds = {};
let isGM = false;
let me;

function roll(type) {
    let name = document.getElementById("roll-name").value || "Check";
    let dice = document.getElementById("roll-content").value || "1d20";
    let typeStr = type == "advantage" ? " (Adv)" : " (Disadv)";
    TS.dice.putDiceInTray([{ name: name + typeStr, roll: dice }, { name: name + typeStr, roll: dice }], true).then((diceSetResponse) => {
        trackedIds[diceSetResponse] = type;
    });
}

async function rollDualityDice() {
    const modifier = parseInt(document.getElementById("modifier").value) || 0;
    const advDisadv = document.getElementById("adv-disadv").value;
    const replaceHopeWithD20 = document.getElementById("hope-d20-toggle").checked;

    // Define the dice groups
    const diceGroups = [
        { name: "Hope", roll: replaceHopeWithD20 ? "1d20" : "1d12", color: "yellow" },
        { name: "Fear", roll: "1d12", color: "purple" }
    ];

    // Add advantage/disadvantage if applicable
    if (advDisadv === "advantage") {
        diceGroups.push({ name: "Advantage", roll: "1d6" });
    } else if (advDisadv === "disadvantage") {
        diceGroups.push({ name: "Disadvantage", roll: "1d6" });
    }

    // Roll the dice
    const diceSetResponse = await TS.dice.putDiceInTray(diceGroups, true);
    trackedIds[diceSetResponse] = { modifier, advDisadv };
}

async function handleRollResult(rollEvent) {
    if (!trackedIds[rollEvent.payload.rollId]) {
        return;
    }

    const trackedData = trackedIds[rollEvent.payload.rollId];
    const { modifier, advDisadv } = trackedData;

    if (rollEvent.kind === "rollResults") {
        const roll = rollEvent.payload;
        let hopeResult = 0;
        let fearResult = 0;
        let advDisadvResult = 0;

        for (const group of roll.resultsGroups) {
            const groupSum = await TS.dice.evaluateDiceResultsGroup(group);

            if (group.name === "Hope") {
                hopeResult = groupSum;
            } else if (group.name === "Fear") {
                fearResult = groupSum;
            } else if (group.name === "Advantage" || group.name === "Disadvantage") {
                advDisadvResult = groupSum;
            }
        }

        // Calculate the final result
        let totalResult = hopeResult + fearResult + modifier;
        if (advDisadv === "advantage") {
            totalResult += advDisadvResult;
        } else if (advDisadv === "disadvantage") {
            totalResult -= advDisadvResult;
        }

        // Determine the outcome
        let outcome = "";
        if (hopeResult === fearResult) {
            outcome = "Critical Success!";
        } else if (hopeResult > fearResult) {
            outcome = "With Hope";
        } else {
            outcome = "With Fear";
        }

        // Display the result in the in-game chat message
        let outcomeColor = "#FFFFFF";
        if (outcome === "Critical Success!") {
            outcomeColor = "#00FF00"; // Green
        } else if (outcome === "With Hope") {
            outcomeColor = "#4FC3F7"; // Light Blue
        } else if (outcome === "With Fear") {
            outcomeColor = "#E57373"; // Red
        }

        const chatMessage = {
            content:
                `<b>Roll Result:</b> ` +
                `<color=#FFD700>Hope ${hopeResult}</color> + ` +
                `<color=#B388FF>Fear ${fearResult}</color>` +
                `${modifier !== 0 ? ` + Modifier ${modifier}` : ""}` +
                `${advDisadvResult !== 0 ? ` + <i>${advDisadv === "advantage" ? "Adv" : "Dis"} ${advDisadvResult}</i>` : ""} = ` +
                `<br><b><color=#FFFFFF>${totalResult}</color></b> ` +
                ` <i><color=${outcomeColor}>${outcome}</color></i>`,
            rollId: roll.rollId,
            expanded: true
        };

        TS.chat.send(chatMessage.content, "board").catch((response) => console.error("error in sending chat message", response));

        // Display the result in the console
        console.log(`Total Result: ${totalResult} (${outcome})`);

        displayResult(roll.resultsGroups, roll.rollId);
    } else if (rollEvent.kind === "rollRemoved") {
        delete trackedIds[rollEvent.payload.rollId];
    }
}

async function displayResult(resultGroup, rollId) {
    TS.dice.sendDiceResult(resultGroup, rollId).catch((response) => console.error("error in sending dice result", response));
}