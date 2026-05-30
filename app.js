document.addEventListener('DOMContentLoaded', () => {
    // 1. Input DOM Elements
    const equityInput = document.getElementById('account-equity');
    const riskPercentInput = document.getElementById('risk-percent');
    const leverageInput = document.getElementById('leverage-multiplier');
    const entryInput = document.getElementById('entry-price');
    const stopLossInput = document.getElementById('stop-loss');

    // 2. Output DOM Elements
    const absoluteRiskDisplay = document.getElementById('absolute-risk-display');
    const calcQtyDisplay = document.getElementById('calc-qty');
    const calcNotionalDisplay = document.getElementById('calc-notional');
    const calcLeverageDisplay = document.getElementById('calc-leverage');
    const leverageTile = document.getElementById('leverage-status-tile');
    const matrixBody = document.getElementById('matrix-body');
    const totalBookedProfitDisplay = document.getElementById('total-booked-profit');

    // 3. Global State: Dynamic Scale-Out Profiles
    let scaleTiersConfig = [
        { name: 'Partial Exit (Risk Free)', rr: 1.0, scalePct: 0.50 },
        { name: 'Core Target 1', rr: 2.0, scalePct: 0.25 },
        { name: 'Core Target 2', rr: 3.0, scalePct: 0.15 },
        { name: 'Runner Target', rr: 5.0, scalePct: 'remainder' } 
    ];

    // 4. Input Listener Hub
    const inputs = [equityInput, riskPercentInput, leverageInput, entryInput, stopLossInput];
    inputs.forEach(input => input.addEventListener('input', calculateRiskMetrics));

    function calculateRiskMetrics() {
        const equity = parseFloat(equityInput.value) || 0;
        const riskPercent = parseFloat(riskPercentInput.value) || 0;
        const maxLeverage = parseFloat(leverageInput.value) || 1;
        const entryPrice = parseFloat(entryInput.value) || 0;
        const stopLoss = parseFloat(stopLossInput.value) || 0;

        // Cash Risk Budgeting
        const cashRisk = equity * (riskPercent / 100);
        absoluteRiskDisplay.textContent = `₹${cashRisk.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

        if (entryPrice <= 0 || stopLoss <= 0 || entryPrice === stopLoss) {
            clearOutputs();
            return;
        }

        const isLong = entryPrice > stopLoss;
        const riskPerUnit = Math.abs(entryPrice - stopLoss);

        // Core Quantity Math
        let positionQty = Math.floor(cashRisk / riskPerUnit);
        if (positionQty < 0) positionQty = 0;

        const totalNotionalValue = positionQty * entryPrice;
        const requiredLeverageFactor = totalNotionalValue / equity;

        // Leverage Envelope Warning System
        if (requiredLeverageFactor > maxLeverage) {
            leverageTile.style.borderLeft = "4px solid var(--accent-rose)";
            calcLeverageDisplay.style.color = "var(--accent-rose)";
        } else {
            leverageTile.style.borderLeft = "none";
            calcLeverageDisplay.style.color = "var(--text-main)";
        }

        calcQtyDisplay.textContent = positionQty.toLocaleString('en-IN');
        calcNotionalDisplay.textContent = `₹${totalNotionalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
        calcLeverageDisplay.textContent = `${requiredLeverageFactor.toFixed(2)}x`;

        generateMatrixRows(entryPrice, riskPerUnit, positionQty, isLong);
    }

    function generateMatrixRows(entry, riskPerUnit, totalQty, isLong) {
        matrixBody.innerHTML = ''; 
        
        let sharesAllocatedSoFar = 0;
        let cumulativeMatrixProfit = 0;

        scaleTiersConfig.forEach((tier, index) => {
            let sharesToScale = 0;
            if (tier.scalePct === 'remainder') {
                sharesToScale = totalQty - sharesAllocatedSoFar;
                if (sharesToScale < 0) sharesToScale = 0;
            } else {
                sharesToScale = Math.floor(totalQty * tier.scalePct);
                sharesAllocatedSoFar += sharesToScale;
            }

            const targetPrice = isLong ? (entry + (tier.rr * riskPerUnit)) : (entry - (tier.rr * riskPerUnit));
            const bookedProfitAtTarget = sharesToScale * (tier.rr * riskPerUnit);
            
            // Accumulate profit across the matrix engine
            cumulativeMatrixProfit += bookedProfitAtTarget;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${tier.name}</strong></td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="number" step="0.1" min="0.1" class="rr-edit-input" data-index="${index}" value="${tier.rr}" 
                            style="width: 70px; padding: 0.4rem; background: rgba(10, 14, 22, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); color: #f1f5f9; border-radius: 6px; font-family: inherit; font-size: 0.9rem;">
                        <span style="color: #94a3b8; font-size: 0.9rem; font-weight: 500;">R</span>
                    </div>
                </td>
                <td>₹${targetPrice.toFixed(2)}</td>
                <td>
                    <span style="color: #10b981; font-weight: 600;">+₹${bookedProfitAtTarget.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </td>
                <td>${sharesToScale} Units</td>
            `;
            matrixBody.appendChild(row);
        });

        // Set the unified total aggregate footer valuation
        totalBookedProfitDisplay.textContent = `₹${cumulativeMatrixProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

        // Re-attach custom user input handlers
        const rrInputs = document.querySelectorAll('.rr-edit-input');
        rrInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                const newRR = parseFloat(e.target.value);
                
                if(!isNaN(newRR) && newRR > 0) {
                    scaleTiersConfig[index].rr = newRR;
                    refreshMatrixOnly(entry, riskPerUnit, totalQty, isLong); 
                }
            });
        });
    }

    function refreshMatrixOnly(entry, riskPerUnit, totalQty, isLong) {
        let sharesAllocatedSoFar = 0;
        let cumulativeMatrixProfit = 0;
        const rows = matrixBody.querySelectorAll('tr');

        scaleTiersConfig.forEach((tier, index) => {
            let sharesToScale = 0;
            if (tier.scalePct === 'remainder') {
                sharesToScale = totalQty - sharesAllocatedSoFar;
                if (sharesToScale < 0) sharesToScale = 0;
            } else {
                sharesToScale = Math.floor(totalQty * tier.scalePct);
                sharesAllocatedSoFar += sharesToScale;
            }

            const targetPrice = isLong ? (entry + (tier.rr * riskPerUnit)) : (entry - (tier.rr * riskPerUnit));
            const bookedProfitAtTarget = sharesToScale * (tier.rr * riskPerUnit);
            cumulativeMatrixProfit += bookedProfitAtTarget;

            const cells = rows[index].querySelectorAll('td');
            cells[2].textContent = `₹${targetPrice.toFixed(2)}`;
            cells[3].innerHTML = `<span style="color: #10b981; font-weight: 600;">+₹${bookedProfitAtTarget.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>`;
            cells[4].textContent = `${sharesToScale} Units`;
        });

        totalBookedProfitDisplay.textContent = `₹${cumulativeMatrixProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    }

    function clearOutputs() {
        calcQtyDisplay.textContent = '0';
        calcNotionalDisplay.textContent = '₹0';
        calcLeverageDisplay.textContent = '0.00x';
        totalBookedProfitDisplay.textContent = '₹0';
        matrixBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding: 2rem;">Awaiting valid entry and stop loss pricing...</td></tr>';
    }

    calculateRiskMetrics();
});