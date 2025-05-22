let scoreChart = null;
let boxPlotChart = null;
let histogramChart = null;
const defaultColors = [
    'rgb(255, 99, 132)',   // pink
    'rgb(54, 162, 235)',   // blue
    'rgb(75, 192, 192)',   // teal
    'rgb(255, 159, 64)',   // orange
    'rgb(153, 102, 255)',  // purple
    'rgb(255, 205, 86)',   // yellow
    'rgb(201, 203, 207)'   // gray
];

// Grid Removal Mode Functions
let currentRemovalMode = null; // 'row', 'column', or null

function parseData(text) {
    // Split into lines and remove empty lines
    const lines = text.trim().split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        throw new Error('Data must have at least a header row and one data row');
    }

    // Parse header row - split by tabs or multiple spaces
    const headers = lines[0].split('\t').map(h => h.trim()).filter(h => h);
    if (headers.length < 2) {
        throw new Error('Data must have at least 2 columns');
    }

    // Parse data rows
    const data = {};
    headers.forEach(header => {
        data[header] = [];
    });

    for (let i = 1; i < lines.length; i++) {
        // Split by tabs or multiple spaces, and filter out empty values
        const values = lines[i].split(/[\t\s]+/).map(v => v.trim()).filter(v => v);
        if (values.length !== headers.length) {
            throw new Error(`Row ${i + 1} has ${values.length} columns, expected ${headers.length}`);
        }

        values.forEach((value, j) => {
            // Remove commas and convert to number
            const numValue = parseFloat(value.replace(/,/g, ''));
            if (isNaN(numValue)) {
                throw new Error(`Invalid number in row ${i + 1}, column ${j + 1}: "${value}"`);
            }
            data[headers[j]].push(numValue);
        });
    }

    return data;
}

function calculateMean(array) {
    return array.reduce((a, b) => a + b, 0) / array.length;
}

function calculateStdDev(array) {
    const mean = calculateMean(array);
    const squareDiffs = array.map(value => {
        const diff = value - mean;
        return diff * diff;
    });
    const avgSquareDiff = calculateMean(squareDiffs);
    return Math.sqrt(avgSquareDiff);
}

function calculateANOVA(groups) {
    // Calculate grand mean
    const allValues = groups.flat();
    const grandMean = calculateMean(allValues);
    
    // Calculate between-group sum of squares
    const betweenGroupSS = groups.reduce((sum, group) => {
        const groupMean = calculateMean(group);
        return sum + group.length * Math.pow(groupMean - grandMean, 2);
    }, 0);
    
    // Calculate within-group sum of squares
    const withinGroupSS = groups.reduce((sum, group) => {
        const groupMean = calculateMean(group);
        return sum + group.reduce((groupSum, value) => {
            return groupSum + Math.pow(value - groupMean, 2);
        }, 0);
    }, 0);
    
    // Calculate degrees of freedom
    const dfBetween = groups.length - 1;
    const dfWithin = allValues.length - groups.length;
    
    // Calculate mean squares
    const msBetween = betweenGroupSS / dfBetween;
    const msWithin = withinGroupSS / dfWithin;
    
    // Calculate F-statistic
    const fStat = msBetween / msWithin;
    
    // Calculate p-value (simplified approximation)
    const pValue = 1 / (1 + Math.exp(fStat));
    
    return { fStat, pValue, dfBetween, dfWithin, msBetween, msWithin };
}

function formatNumber(num) {
    return new Intl.NumberFormat().format(num.toFixed(2));
}

function getStatistics(scores) {
    return {
        mean: calculateMean(scores),
        std_dev: calculateStdDev(scores),
        min: Math.min(...scores),
        max: Math.max(...scores)
    };
}

function createScoreChart(data) {
    const ctx = document.getElementById('scoreChart').getContext('2d');
    const datasets = Object.entries(data).map(([name, scores], index) => ({
        label: name,
        data: scores,
        borderColor: defaultColors[index % defaultColors.length],
        backgroundColor: defaultColors[index % defaultColors.length].replace('rgb', 'rgba').replace(')', ', 0.1)'),
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5
    }));

    if (scoreChart) {
        scoreChart.destroy();
    }

    const maxLength = Math.max(...datasets.map(d => d.data.length));
    const labels = Array.from({length: maxLength}, (_, i) => i + 1);

    // Calculate critical mean (grand mean of all scores)
    const allScores = Object.values(data).flat();
    const criticalMean = calculateMean(allScores);

    scoreChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatNumber(context.raw)}`;
                        }
                    }
                },
                annotation: {
                    annotations: {
                        criticalLine: {
                            type: 'line',
                            yMin: criticalMean,
                            yMax: criticalMean,
                            borderColor: 'rgb(255, 0, 0)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: `Critical Mean: ${formatNumber(criticalMean)}`,
                                enabled: true,
                                position: 'start',
                                backgroundColor: 'rgba(255, 0, 0, 0.1)',
                                padding: 4
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            if (value === criticalMean) {
                                return `Critical Mean: ${formatNumber(value)}`;
                            }
                            return formatNumber(value);
                        }
                    },
                    title: {
                        display: true,
                        text: 'Score'
                    }
                }
            }
        }
    });
}

function updateANOVA(data) {
    const anovaDiv = document.getElementById('anovaResults');
    const groups = Object.values(data);
    
    if (groups.length < 2) {
        anovaDiv.innerHTML = '<p>Add at least 2 strategies to perform ANOVA analysis.</p>';
        return;
    }

    const anovaResult = calculateANOVA(groups);
    
    // Calculate critical mean (grand mean of all scores)
    const allScores = Object.values(data).flat();
    const criticalMean = calculateMean(allScores);

    anovaDiv.innerHTML = `
        <table class="table table-bordered table-sm mb-0">
            <tbody>
                <tr>
                    <th>Critical Mean
                        <i class="bi bi-info-circle" data-bs-toggle="tooltip" data-bs-placement="right" 
                           title="The average of all scores across all strategies. This represents the overall mean performance."></i>
                    </th>
                    <td>${formatNumber(criticalMean)}</td>
                </tr>
                <tr>
                    <th>F-statistic
                        <i class="bi bi-info-circle" data-bs-toggle="tooltip" data-bs-placement="right" 
                           title="Measures the ratio of between-group variance to within-group variance. Higher values indicate stronger evidence against the null hypothesis."></i>
                    </th>
                    <td>${formatNumber(anovaResult.fStat)}</td>
                </tr>
                <tr>
                    <th>P-value
                        <i class="bi bi-info-circle" data-bs-toggle="tooltip" data-bs-placement="right" 
                           title="Probability of obtaining results as extreme as the observed results, assuming the null hypothesis is true. Values < 0.05 typically indicate statistical significance."></i>
                    </th>
                    <td>${anovaResult.pValue.toExponential(4)}</td>
                </tr>
                <tr>
                    <th>Significance
                        <i class="bi bi-info-circle" data-bs-toggle="tooltip" data-bs-placement="right" 
                           title="Indicates whether the differences between groups are statistically significant (p < 0.05) or not."></i>
                    </th>
                    <td>${anovaResult.pValue < 0.05 ? 'Significant' : 'Not Significant'}</td>
                </tr>
                <tr>
                    <th>Degrees of Freedom (Between)
                        <i class="bi bi-info-circle" data-bs-toggle="tooltip" data-bs-placement="right" 
                           title="Number of independent groups minus 1. Represents the number of independent comparisons that can be made between group means."></i>
                    </th>
                    <td>${anovaResult.dfBetween}</td>
                </tr>
                <tr>
                    <th>Degrees of Freedom (Within)
                        <i class="bi bi-info-circle" data-bs-toggle="tooltip" data-bs-placement="right" 
                           title="Total number of observations minus the number of groups. Represents the number of independent pieces of information available for estimating within-group variation."></i>
                    </th>
                    <td>${anovaResult.dfWithin}</td>
                </tr>
                <tr>
                    <th>Mean Square (Between)
                        <i class="bi bi-info-circle" data-bs-toggle="tooltip" data-bs-placement="right" 
                           title="Variance between groups, calculated as the sum of squares between groups divided by degrees of freedom between."></i>
                    </th>
                    <td>${formatNumber(anovaResult.msBetween)}</td>
                </tr>
                <tr>
                    <th>Mean Square (Within)
                        <i class="bi bi-info-circle" data-bs-toggle="tooltip" data-bs-placement="right" 
                           title="Variance within groups, calculated as the sum of squares within groups divided by degrees of freedom within."></i>
                    </th>
                    <td>${formatNumber(anovaResult.msWithin)}</td>
                </tr>
            </tbody>
        </table>
    `;

    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

function updateSummaryStats(data) {
    const statsDiv = document.getElementById('summaryStats');
    let html = '';
    
    Object.entries(data).forEach(([name, scores]) => {
        const stats = getStatistics(scores);
        html += `
            <h6>
                <span class="strategy-color" style="background-color: ${defaultColors[Object.keys(data).indexOf(name) % defaultColors.length]}"></span>
                ${name}
            </h6>
            <p><strong>Mean:</strong> <span class="value">${formatNumber(stats.mean)}</span></p>
            <p><strong>Std Dev:</strong> <span class="value">${formatNumber(stats.std_dev)}</span></p>
            <p><strong>Min:</strong> <span class="value">${formatNumber(stats.min)}</span></p>
            <p><strong>Max:</strong> <span class="value">${formatNumber(stats.max)}</span></p>
            <p><strong>Sample Size:</strong> <span class="value">${scores.length}</span></p>
            <hr>
        `;
    });
    
    statsDiv.innerHTML = html;
}

function calculateBoxPlotStats(scores) {
    const sorted = [...scores].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const median = sorted[Math.floor(sorted.length * 0.5)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const iqr = q3 - q1;
    const lowerWhisker = Math.max(min, q1 - 1.5 * iqr);
    const upperWhisker = Math.min(max, q3 + 1.5 * iqr);
    
    return {
        min: lowerWhisker,
        q1,
        median,
        q3,
        max: upperWhisker,
        outliers: sorted.filter(x => x < lowerWhisker || x > upperWhisker)
    };
}

function createBoxPlot(data) {
    const ctx = document.getElementById('boxPlotChart').getContext('2d');
    const strategies = Object.keys(data);
    const datasets = strategies.map((name, index) => {
        const scores = data[name];
        const stats = calculateBoxPlotStats(scores);
        return {
            label: name,
            data: [{
                min: stats.min,
                q1: stats.q1,
                median: stats.median,
                q3: stats.q3,
                max: stats.max,
                outliers: stats.outliers
            }]
        };
    });

    // Calculate critical mean (grand mean of all scores)
    const allScores = Object.values(data).flat();
    const criticalMean = calculateMean(allScores);

    if (boxPlotChart) {
        boxPlotChart.destroy();
    }

    // Create custom box plot using bar chart
    const boxPlotData = {
        labels: strategies,
        datasets: [{
            label: 'Min',
            data: datasets.map(d => d.data[0].min),
            backgroundColor: 'rgba(0, 0, 0, 0)',
            borderColor: 'rgba(0, 0, 0, 0)',
            borderWidth: 0,
            pointBackgroundColor: 'rgba(0, 0, 0, 0)',
            pointBorderColor: 'rgba(0, 0, 0, 0)',
            pointRadius: 0,
            order: 1
        }, {
            label: 'Q1',
            data: datasets.map(d => d.data[0].q1),
            backgroundColor: defaultColors.map(c => c.replace('rgb', 'rgba').replace(')', ', 0.2)')),
            borderColor: defaultColors,
            borderWidth: 1,
            order: 2
        }, {
            label: 'Median',
            data: datasets.map(d => d.data[0].median),
            backgroundColor: defaultColors.map(c => c.replace('rgb', 'rgba').replace(')', ', 0.5)')),
            borderColor: defaultColors,
            borderWidth: 1,
            order: 3
        }, {
            label: 'Q3',
            data: datasets.map(d => d.data[0].q3),
            backgroundColor: defaultColors.map(c => c.replace('rgb', 'rgba').replace(')', ', 0.2)')),
            borderColor: defaultColors,
            borderWidth: 1,
            order: 4
        }, {
            label: 'Max',
            data: datasets.map(d => d.data[0].max),
            backgroundColor: 'rgba(0, 0, 0, 0)',
            borderColor: 'rgba(0, 0, 0, 0)',
            borderWidth: 0,
            pointBackgroundColor: 'rgba(0, 0, 0, 0)',
            pointBorderColor: 'rgba(0, 0, 0, 0)',
            pointRadius: 0,
            order: 5
        }]
    };

    boxPlotChart = new Chart(ctx, {
        type: 'bar',
        data: boxPlotData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Score Distribution by Strategy'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const strategy = strategies[context.dataIndex];
                            const stats = datasets[context.dataIndex].data[0];
                            if (context.dataset.label === 'Min') {
                                return `${strategy} - Min: ${formatNumber(stats.min)}`;
                            } else if (context.dataset.label === 'Q1') {
                                return `${strategy} - Q1: ${formatNumber(stats.q1)}`;
                            } else if (context.dataset.label === 'Median') {
                                return `${strategy} - Median: ${formatNumber(stats.median)}`;
                            } else if (context.dataset.label === 'Q3') {
                                return `${strategy} - Q3: ${formatNumber(stats.q3)}`;
                            } else if (context.dataset.label === 'Max') {
                                return `${strategy} - Max: ${formatNumber(stats.max)}`;
                            }
                        }
                    }
                },
                annotation: {
                    annotations: {
                        criticalLine: {
                            type: 'line',
                            yMin: criticalMean,
                            yMax: criticalMean,
                            borderColor: 'rgb(255, 0, 0)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: `Critical Mean: ${formatNumber(criticalMean)}`,
                                enabled: true,
                                position: 'start',
                                backgroundColor: 'rgba(255, 0, 0, 0.1)',
                                padding: 4
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    stacked: true,
                    ticks: {
                        callback: function(value) {
                            if (value === criticalMean) {
                                return `Critical Mean: ${formatNumber(value)}`;
                            }
                            return formatNumber(value);
                        }
                    },
                    title: {
                        display: true,
                        text: 'Score'
                    }
                }
            }
        }
    });

    // Add outlier points
    datasets.forEach((dataset, index) => {
        const outliers = dataset.data[0].outliers;
        if (outliers.length > 0) {
            const outlierDataset = {
                label: 'Outliers',
                data: strategies.map((_, i) => i === index ? outliers : []),
                backgroundColor: defaultColors[index % defaultColors.length],
                borderColor: defaultColors[index % defaultColors.length],
                pointRadius: 3,
                pointHoverRadius: 5,
                showLine: false,
                order: 0
            };
            boxPlotChart.data.datasets.push(outlierDataset);
        }
    });
    boxPlotChart.update();
}

function createHistogram(data) {
    const ctx = document.getElementById('histogramChart').getContext('2d');
    const datasets = Object.entries(data).map(([name, scores], index) => {
        // Calculate histogram bins
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        const binCount = Math.min(20, Math.ceil(Math.sqrt(scores.length))); // Sturges' rule
        const binSize = (max - min) / binCount;
        const bins = Array(binCount).fill(0);
        
        scores.forEach(score => {
            const binIndex = Math.min(Math.floor((score - min) / binSize), binCount - 1);
            bins[binIndex]++;
        });

        return {
            label: name,
            data: bins,
            backgroundColor: defaultColors[index % defaultColors.length].replace('rgb', 'rgba').replace(')', ', 0.5)'),
            borderColor: defaultColors[index % defaultColors.length],
            borderWidth: 1
        };
    });

    // Calculate critical mean (grand mean of all scores)
    const allScores = Object.values(data).flat();
    const criticalMean = calculateMean(allScores);

    if (histogramChart) {
        histogramChart.destroy();
    }

    const min = Math.min(...Object.values(data).flat());
    const max = Math.max(...Object.values(data).flat());
    const binCount = Math.min(20, Math.ceil(Math.sqrt(Object.values(data)[0].length)));
    const binSize = (max - min) / binCount;
    const labels = Array.from({length: binCount}, (_, i) => 
        formatNumber(min + i * binSize) + ' - ' + formatNumber(min + (i + 1) * binSize)
    );

    histogramChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Score Distribution Histogram'
                },
                annotation: {
                    annotations: {
                        criticalLine: {
                            type: 'line',
                            xMin: criticalMean,
                            xMax: criticalMean,
                            borderColor: 'rgb(255, 0, 0)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: `Critical Mean: ${formatNumber(criticalMean)}`,
                                enabled: true,
                                position: 'start',
                                backgroundColor: 'rgba(255, 0, 0, 0.1)',
                                padding: 4
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Frequency'
                    }
                }
            }
        }
    });
}

function calculateCorrelationMatrix(data) {
    const strategies = Object.keys(data);
    const matrix = {};
    
    strategies.forEach(strat1 => {
        matrix[strat1] = {};
        strategies.forEach(strat2 => {
            const scores1 = data[strat1];
            const scores2 = data[strat2];
            const mean1 = calculateMean(scores1);
            const mean2 = calculateMean(scores2);
            
            const covariance = scores1.reduce((sum, score, i) => 
                sum + (score - mean1) * (scores2[i] - mean2), 0) / scores1.length;
            
            const std1 = calculateStdDev(scores1);
            const std2 = calculateStdDev(scores2);
            
            matrix[strat1][strat2] = covariance / (std1 * std2);
        });
    });
    
    return matrix;
}

function updateCorrelationMatrix(data) {
    const matrixDiv = document.getElementById('correlationMatrix');
    const matrix = calculateCorrelationMatrix(data);
    const strategies = Object.keys(data);
    
    // Create container for matrix and download button
    const container = document.createElement('div');
    container.className = 'correlation-matrix-container';
    
    // Create header with title and download button
    const headerDiv = document.createElement('div');
    headerDiv.className = 'd-flex justify-content-between align-items-center mb-3';
    headerDiv.innerHTML = `
        <h5 class="card-title mb-0">Correlation Matrix</h5>
        <button class="btn btn-outline-primary btn-sm download-btn" onclick="downloadCorrelationMatrix()">
            <i class="bi bi-download"></i> Download
        </button>
    `;
    container.appendChild(headerDiv);
    
    // Create matrix table
    let html = '<div class="table-responsive"><table class="table table-sm" id="correlationMatrixTable">';
    
    // Header row
    html += '<thead><tr><th></th>';
    strategies.forEach(strat => {
        html += `<th>${strat}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    // Data rows
    strategies.forEach(strat1 => {
        html += `<tr><th>${strat1}</th>`;
        strategies.forEach(strat2 => {
            const corr = matrix[strat1][strat2];
            // Use more muted colors with lower opacity
            const color = corr > 0 ? 
                `rgba(100, 180, 100, ${Math.abs(corr) * 0.5})` : // Muted green
                `rgba(180, 100, 100, ${Math.abs(corr) * 0.5})`;  // Muted red
            html += `<td style="background-color: ${color}">${corr.toFixed(3)}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    
    // Add table to container
    const tableDiv = document.createElement('div');
    tableDiv.innerHTML = html;
    container.appendChild(tableDiv);
    
    // Clear and update matrix div
    matrixDiv.innerHTML = '';
    matrixDiv.appendChild(container);
}

// Function to download correlation matrix as PNG
async function downloadCorrelationMatrix() {
    try {
        // Check if html2canvas is loaded
        if (typeof html2canvas === 'undefined') {
            // Load html2canvas dynamically
            const script = document.createElement('script');
            script.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
            document.head.appendChild(script);
            
            // Wait for script to load
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
            });
        }
        
        const table = document.getElementById('correlationMatrixTable');
        if (!table) {
            throw new Error('Correlation matrix table not found');
        }
        
        const button = table.closest('.correlation-matrix-container').querySelector('button');
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="bi bi-hourglass-split"></i> Generating...';
        button.disabled = true;
        
        // Convert table to canvas
        const canvas = await html2canvas(table, {
            scale: 2, // Higher quality
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true
        });
        
        // Create download link
        const link = document.createElement('a');
        link.download = `correlation-matrix-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Restore button state
        button.innerHTML = originalText;
        button.disabled = false;
        
    } catch (error) {
        console.error('Error downloading correlation matrix:', error);
        alert('Error downloading correlation matrix: ' + error.message);
    }
}

// Grid Input Functions
function removeRow(rowIndex) {
    const tbody = document.querySelector('#dataGrid tbody');
    if (tbody.rows.length <= 1) {
        alert('Cannot remove the last row');
        return;
    }
    tbody.deleteRow(rowIndex);
    // Update row indices for remaining rows
    const rows = tbody.getElementsByTagName('tr');
    for (let i = 0; i < rows.length; i++) {
        const removeBtn = rows[i].querySelector('.btn-remove-row');
        removeBtn.onclick = () => removeRow(i);
    }
}

function removeColumn(clickedButton) {
    const table = document.getElementById('dataGrid');
    const headerRow = table.querySelector('thead tr');
    const rows = table.querySelectorAll('tbody tr');
    
    // Find the header cell by going up from the button through the column-header div
    const headerCell = clickedButton.closest('.column-header').parentElement;
    
    // Find the clicked column's position in the DOM
    const columnIndex = Array.from(headerRow.children).indexOf(headerCell);
    
    if (columnIndex === -1) {
        console.error('Could not find column to remove');
        return;
    }
    
    if (headerRow.cells.length <= 2) { // Keep at least one data column
        alert('Cannot remove the last column');
        return;
    }
    
    // Remove the header cell
    headerRow.deleteCell(columnIndex);
    
    // Remove cells from each row at the same index
    rows.forEach(row => {
        row.deleteCell(columnIndex);
    });
    
    // Update all remove buttons with new event handlers
    const headers = headerRow.getElementsByTagName('th');
    for (let i = 1; i < headers.length; i++) { // Start from 1 to skip remove column
        const removeBtn = headers[i].querySelector('.btn-remove-column');
        if (removeBtn) {
            removeBtn.onclick = function() {
                removeColumn(this);
            };
        }
    }
}

function addRow() {
    const tbody = document.querySelector('#dataGrid tbody');
    const newRow = tbody.insertRow();
    const rowIndex = tbody.rows.length - 1;
    
    // Add remove row button cell
    const removeCell = newRow.insertCell();
    removeCell.className = 'remove-row-cell';
    removeCell.innerHTML = `
        <button class="btn-remove-row" onclick="removeRow(${rowIndex})" title="Remove row">
            <i class="bi bi-x-circle"></i>
        </button>
    `;
    
    // Add data cells
    const headerRow = document.querySelector('#dataGrid thead tr');
    for (let i = 1; i < headerRow.cells.length; i++) { // Start from 1 to skip remove column
        const cell = newRow.insertCell();
        cell.innerHTML = '<input type="number" step="any" placeholder="Enter score">';
    }

    // Scroll to the bottom of the table
    const gridWrapper = document.querySelector('.grid-wrapper');
    gridWrapper.scrollTo({
        top: gridWrapper.scrollHeight,
        behavior: 'smooth'
    });
}

function addColumn() {
    const table = document.getElementById('dataGrid');
    const headerRow = table.querySelector('thead tr');
    const rows = table.querySelectorAll('tbody tr');
    
    // Add header cell with remove button
    const headerCell = headerRow.insertCell();
    headerCell.innerHTML = `
        <div class="column-header">
            <input type="text" class="header-input" placeholder="Strategy ${headerRow.cells.length - 1}">
            <button class="btn-remove-column" title="Remove column">
                <i class="bi bi-x-circle"></i>
            </button>
        </div>
    `;
    
    // Add cells to each row
    rows.forEach(row => {
        const cell = row.insertCell();
        cell.innerHTML = '<input type="number" step="any" placeholder="Enter score">';
    });
    
    // Set up the remove button click handler
    const removeBtn = headerCell.querySelector('.btn-remove-column');
    removeBtn.onclick = function() {
        removeColumn(this);
    };
}

function getGridData() {
    const headers = Array.from(document.querySelectorAll('#dataGrid thead input'))
        .map(input => input.value.trim())
        .filter(value => value !== '');

    if (headers.length === 0) {
        throw new Error('Please enter at least one strategy name in the header row');
    }

    const data = {};
    headers.forEach(header => {
        data[header] = [];
    });

    const rows = document.querySelectorAll('#dataGrid tbody tr');
    rows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        if (inputs.length !== headers.length) {
            throw new Error('Invalid number of columns in data row');
        }

        inputs.forEach((input, index) => {
            const value = input.value.trim();
            if (value !== '') {
                // Remove commas and convert to number
                const numValue = parseFloat(value.replace(/,/g, ''));
                if (isNaN(numValue)) {
                    throw new Error(`Invalid number: ${value}`);
                }
                data[headers[index]].push(numValue);
            }
        });
    });

    // Check if all columns have the same number of values
    const lengths = Object.values(data).map(arr => arr.length);
    if (new Set(lengths).size > 1) {
        throw new Error('All strategies must have the same number of scores');
    }

    return data;
}

// Helper function to clean cell values
function cleanCellValue(cell) {
    // Remove surrounding quotes if present
    cell = cell.trim().replace(/^"|"$/g, '');
    
    // If the cell contains only numbers and commas, remove the commas
    if (/^[0-9,]+$/.test(cell)) {
        cell = cell.replace(/,/g, '');
    }
    
    return cell;
}

function resetGrid() {
    // Clear existing grid
    const headerRow = document.querySelector('#dataGrid thead tr');
    const tbody = document.querySelector('#dataGrid tbody');
    
    // Reset header row with remove column button
    headerRow.innerHTML = '';
    const removeColHeader = document.createElement('th');
    removeColHeader.className = 'remove-col-header';
    headerRow.appendChild(removeColHeader);

    // Add first strategy column with remove button
    const headerTh = document.createElement('th');
    headerTh.innerHTML = `
        <div class="column-header">
            <input type="text" class="header-input" placeholder="Strategy 1">
            <button class="btn-remove-column" title="Remove column">
                <i class="bi bi-x-circle"></i>
            </button>
        </div>
    `;
    headerRow.appendChild(headerTh);
    
    // Set up the remove button click handler
    const removeBtn = headerTh.querySelector('.btn-remove-column');
    removeBtn.onclick = function() {
        removeColumn(this);
    };

    // Reset to two empty rows with remove buttons
    tbody.innerHTML = '';
    
    // Create first empty row
    const emptyRow1 = document.createElement('tr');
    const removeCell1 = document.createElement('td');
    removeCell1.className = 'remove-row-cell';
    removeCell1.innerHTML = `
        <button class="btn-remove-row" onclick="removeRow(0)" title="Remove row">
            <i class="bi bi-x-circle"></i>
        </button>
    `;
    emptyRow1.appendChild(removeCell1);
    const dataTd1 = document.createElement('td');
    const dataInput1 = document.createElement('input');
    dataInput1.type = 'number';
    dataInput1.step = 'any';
    dataInput1.placeholder = 'Enter score';
    dataTd1.appendChild(dataInput1);
    emptyRow1.appendChild(dataTd1);
    tbody.appendChild(emptyRow1);

    // Create second empty row
    const emptyRow2 = document.createElement('tr');
    const removeCell2 = document.createElement('td');
    removeCell2.className = 'remove-row-cell';
    removeCell2.innerHTML = `
        <button class="btn-remove-row" onclick="removeRow(1)" title="Remove row">
            <i class="bi bi-x-circle"></i>
        </button>
    `;
    emptyRow2.appendChild(removeCell2);
    const dataTd2 = document.createElement('td');
    const dataInput2 = document.createElement('input');
    dataInput2.type = 'number';
    dataInput2.step = 'any';
    dataInput2.placeholder = 'Enter score';
    dataTd2.appendChild(dataInput2);
    emptyRow2.appendChild(dataTd2);
    tbody.appendChild(emptyRow2);

    // Clear any error messages
    const errorAlert = document.getElementById('errorAlert');
    errorAlert.style.display = 'none';
    errorAlert.textContent = '';

    // Clear any success messages
    const indicator = document.getElementById('pasteIndicator');
    indicator.style.display = 'none';

    // Clear file input if it exists
    const fileInput = document.getElementById('csvFile');
    if (fileInput) {
        fileInput.value = '';
    }

    // Hide analysis content
    const analysisContent = document.getElementById('analysisContent');
    analysisContent.classList.remove('visible');

    // Destroy any existing charts
    if (scoreChart) {
        scoreChart.destroy();
        scoreChart = null;
    }
    if (boxPlotChart) {
        boxPlotChart.destroy();
        boxPlotChart = null;
    }
    if (histogramChart) {
        histogramChart.destroy();
        histogramChart = null;
    }

    disableRemovalMode();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded event fired');
    
    // Add Bootstrap Icons
    const link = document.createElement('link');
    link.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // Create removal mode indicator if it doesn't exist
    if (!document.getElementById('removalModeIndicator')) {
        const indicator = document.createElement('div');
        indicator.id = 'removalModeIndicator';
        indicator.style.display = 'none';
        indicator.style.position = 'fixed';
        indicator.style.top = '10px';
        indicator.style.left = '50%';
        indicator.style.transform = 'translateX(-50%)';
        indicator.style.backgroundColor = '#ffc107';
        indicator.style.color = '#000';
        indicator.style.padding = '8px 16px';
        indicator.style.borderRadius = '4px';
        indicator.style.zIndex = '1000';
        indicator.style.alignItems = 'center';
        indicator.style.gap = '8px';
        
        const icon = document.createElement('i');
        icon.className = 'bi bi-exclamation-triangle';
        
        const text = document.createElement('span');
        text.id = 'removalModeText';
        
        indicator.appendChild(icon);
        indicator.appendChild(text);
        document.body.appendChild(indicator);
    }

    // Analyze button click handler
    document.getElementById('analyzeBtn').addEventListener('click', function() {
        const errorAlert = document.getElementById('errorAlert');
        const analysisContent = document.getElementById('analysisContent');
        
        try {
            errorAlert.style.display = 'none';
            const data = getGridData();
            
            // Show analysis content
            analysisContent.classList.add('visible');
            
            createScoreChart(data);
            createBoxPlot(data);
            createHistogram(data);
            updateANOVA(data);
            updateSummaryStats(data);
            updateCorrelationMatrix(data);
        } catch (error) {
            errorAlert.textContent = error.message;
            errorAlert.style.display = 'block';
            // Hide analysis content on error
            analysisContent.classList.remove('visible');
        }
    });

    // Update keyboard shortcut handler
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            // If no element is focused or focused element is not an input, focus the grid
            if (document.activeElement.tagName !== 'INPUT') {
                const firstInput = document.querySelector('#dataGrid input');
                if (firstInput) {
                    firstInput.focus();
                }
            }
        }
    });

    // Add click handler to focus the grid container
    document.querySelector('.grid-input-container').addEventListener('click', function(e) {
        // If clicking on the container (not an input), focus the first input
        if (e.target === this) {
            const firstInput = this.querySelector('input');
            if (firstInput) {
                firstInput.focus();
            }
        }
    });

    // Initialize grid
    resetGrid();

    // Add click handlers for row and column removal
    const grid = document.getElementById('dataGrid');
    
    grid.addEventListener('click', function(e) {
        if (!currentRemovalMode) return;

        if (currentRemovalMode === 'row') {
            const row = e.target.closest('.data-row');
            if (row && document.querySelectorAll('#dataGrid .data-row').length > 1) {
                row.remove();
                // Update any existing charts or analysis
                try {
                    const data = getGridData();
                    updateAnalysis(data);
                } catch (error) {
                    // Ignore errors if data is invalid after removal
                }
            }
        } else if (currentRemovalMode === 'column') {
            const header = e.target.closest('.header-cell');
            if (header && document.querySelectorAll('#dataGrid .header-cell').length > 1) {
                const index = Array.from(header.parentElement.children).indexOf(header);
                // Remove the header
                header.remove();
                // Remove corresponding cells in each row
                document.querySelectorAll('#dataGrid .data-row').forEach(row => {
                    row.children[index].remove();
                });
                // Update any existing charts or analysis
                try {
                    const data = getGridData();
                    updateAnalysis(data);
                } catch (error) {
                    // Ignore errors if data is invalid after removal
                }
            }
        }
    });

    // Disable removal mode when clicking outside the grid
    document.addEventListener('click', function(e) {
        if (!e.target.closest('#dataGrid') && !e.target.closest('#gridToolsDropdown')) {
            disableRemovalMode();
        }
    });

    // Add paste button click handler
    const pasteBtn = document.getElementById('pasteBtn');
    console.log('Paste button element:', pasteBtn);
    
    if (!pasteBtn) {
        console.error('Paste button not found');
        return;
    }

    // Create a hidden textarea for fallback paste
    const textarea = document.createElement('textarea');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);

    // Add click handler directly to the button
    pasteBtn.onclick = async function(e) {
        console.log('Paste button clicked');
        e.preventDefault();
        
        try {
            let clipboardText;
            
            // Try using the Clipboard API first
            if (navigator.clipboard && navigator.clipboard.readText) {
                console.log('Using Clipboard API...');
                clipboardText = await navigator.clipboard.readText();
            } else {
                // Fallback: Use a temporary textarea
                console.log('Using fallback paste method...');
                textarea.value = '';
                textarea.focus();
                
                // Wait for paste event
                const pastePromise = new Promise(resolve => {
                    textarea.onpaste = function(e) {
                        e.preventDefault();
                        resolve(textarea.value);
                    };
                });
                
                // Trigger paste
                document.execCommand('paste');
                clipboardText = await pastePromise;
            }
            
            console.log('Clipboard content:', clipboardText);
            
            if (!clipboardText.trim()) {
                throw new Error('Clipboard is empty');
            }

            // Parse clipboard text into rows
            const rows = clipboardText.trim().split('\n').map(row => {
                // Split by tab only, preserving spaces within values
                const cells = row.split('\t').map(cell => cleanCellValue(cell));
                console.log('Parsed row:', cells);
                return cells;
            });

            console.log('Parsed rows:', rows);

            if (rows.length < 2) {
                throw new Error('Pasted data must have at least a header row and one data row');
            }

            // Validate that all rows have the same number of columns
            const columnCount = rows[0].length;
            if (!rows.every(row => row.length === columnCount)) {
                throw new Error('All rows must have the same number of columns');
            }

            // Validate headers
            if (rows[0].some(header => !header.trim())) {
                throw new Error('All columns must have a header name');
            }

            // Validate data rows
            for (let i = 1; i < rows.length; i++) {
                for (let j = 0; j < rows[i].length; j++) {
                    const value = rows[i][j];
                    if (value === '') continue; // Allow empty cells
                    
                    // Remove commas and validate number
                    const numValue = parseFloat(value.replace(/,/g, ''));
                    if (isNaN(numValue)) {
                        throw new Error(`Invalid number in row ${i + 1}, column ${j + 1}: "${value}"`);
                    }
                }
            }

            // Clear existing grid
            const headerRow = document.querySelector('#dataGrid thead tr');
            const tbody = document.querySelector('#dataGrid tbody');
            headerRow.innerHTML = '';
            tbody.innerHTML = '';

            // Add remove column header cell
            const removeColHeader = document.createElement('th');
            removeColHeader.className = 'remove-col-header';
            headerRow.appendChild(removeColHeader);

            // Add headers with remove buttons
            rows[0].forEach((header, colIndex) => {
                const th = document.createElement('th');
                th.innerHTML = `
                    <div class="column-header">
                        <input type="text" class="header-input" value="${header}">
                        <button class="btn-remove-column" title="Remove column">
                            <i class="bi bi-x-circle"></i>
                        </button>
                    </div>
                `;
                headerRow.appendChild(th);
                
                // Set up the remove button click handler
                const removeBtn = th.querySelector('.btn-remove-column');
                removeBtn.onclick = function() {
                    removeColumn(this);
                };
            });

            // Add data rows with remove buttons
            for (let i = 1; i < rows.length; i++) {
                const tr = document.createElement('tr');
                
                // Add remove row button cell
                const removeCell = document.createElement('td');
                removeCell.className = 'remove-row-cell';
                removeCell.innerHTML = `
                    <button class="btn-remove-row" onclick="removeRow(${i-1})" title="Remove row">
                        <i class="bi bi-x-circle"></i>
                    </button>
                `;
                tr.appendChild(removeCell);

                // Add data cells
                rows[i].forEach(value => {
                    const td = document.createElement('td');
                    const input = document.createElement('input');
                    input.type = 'number';
                    input.step = 'any';
                    input.value = value;
                    td.appendChild(input);
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            }

            // Show success indicator
            const indicator = document.getElementById('pasteIndicator');
            indicator.textContent = `Successfully pasted ${rows.length - 1} rows`;
            indicator.style.display = 'block';
            setTimeout(() => {
                indicator.style.display = 'none';
            }, 2000);

            // Automatically trigger analysis
            document.getElementById('analyzeBtn').click();

        } catch (error) {
            console.error('Paste error:', error);
            const errorAlert = document.getElementById('errorAlert');
            if (errorAlert) {
                errorAlert.textContent = `Error pasting data: ${error.message}`;
                errorAlert.style.display = 'block';
            } else {
                console.error('Error alert element not found');
            }
        } finally {
            // Clean up the textarea
            textarea.value = '';
            textarea.blur();
        }
    };

    console.log('Paste button event listener attached');
});

// CSV file upload handling
function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const csvText = e.target.result;
            
            // Parse CSV with proper handling of quoted values
            const rows = csvText.trim().split('\n').map(row => {
                // Split by comma, but respect quoted values
                const cells = [];
                let currentCell = '';
                let insideQuotes = false;
                
                for (let i = 0; i < row.length; i++) {
                    const char = row[i];
                    
                    if (char === '"') {
                        insideQuotes = !insideQuotes;
                    } else if (char === ',' && !insideQuotes) {
                        cells.push(cleanCellValue(currentCell));
                        currentCell = '';
                    } else {
                        currentCell += char;
                    }
                }
                
                cells.push(cleanCellValue(currentCell));
                return cells;
            });

            if (rows.length < 2) {
                throw new Error('CSV file must have at least a header row and one data row');
            }

            // Validate that all rows have the same number of columns
            const columnCount = rows[0].length;
            if (!rows.every(row => row.length === columnCount)) {
                throw new Error('All rows in the CSV must have the same number of columns');
            }

            // Clear existing grid
            const headerRow = document.querySelector('#dataGrid thead tr');
            const tbody = document.querySelector('#dataGrid tbody');
            headerRow.innerHTML = '';
            tbody.innerHTML = '';

            // Add remove column header cell
            const removeColHeader = document.createElement('th');
            removeColHeader.className = 'remove-col-header';
            headerRow.appendChild(removeColHeader);

            // Add headers with remove buttons
            rows[0].forEach((header, colIndex) => {
                const th = document.createElement('th');
                th.innerHTML = `
                    <div class="column-header">
                        <input type="text" class="header-input" value="${header}">
                        <button class="btn-remove-column" title="Remove column">
                            <i class="bi bi-x-circle"></i>
                        </button>
                    </div>
                `;
                headerRow.appendChild(th);
                
                // Set up the remove button click handler
                const removeBtn = th.querySelector('.btn-remove-column');
                removeBtn.onclick = function() {
                    removeColumn(this);
                };
            });

            // Add data rows with remove buttons
            for (let i = 1; i < rows.length; i++) {
                const tr = document.createElement('tr');
                
                // Add remove row button cell
                const removeCell = document.createElement('td');
                removeCell.className = 'remove-row-cell';
                removeCell.innerHTML = `
                    <button class="btn-remove-row" onclick="removeRow(${i-1})" title="Remove row">
                        <i class="bi bi-x-circle"></i>
                    </button>
                `;
                tr.appendChild(removeCell);

                // Add data cells
                rows[i].forEach(value => {
                    const td = document.createElement('td');
                    const input = document.createElement('input');
                    input.type = 'number';
                    input.step = 'any';
                    
                    // Validate that it's a number
                    const numValue = parseFloat(value);
                    if (isNaN(numValue)) {
                        throw new Error(`Invalid number in row ${i + 1}: "${value}"`);
                    }
                    
                    input.value = value;
                    td.appendChild(input);
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            }

            // Show success indicator
            const indicator = document.getElementById('pasteIndicator');
            indicator.textContent = `Successfully loaded ${rows.length - 1} rows from CSV`;
            indicator.style.display = 'block';
            setTimeout(() => {
                indicator.style.display = 'none';
            }, 2000);

            // Automatically trigger analysis
            document.getElementById('analyzeBtn').click();

        } catch (error) {
            console.error('CSV upload error:', error);
            const errorAlert = document.getElementById('errorAlert');
            errorAlert.textContent = `Error loading CSV: ${error.message}`;
            errorAlert.style.display = 'block';
        }

        // Reset the file input
        event.target.value = '';
    };

    reader.onerror = function() {
        const errorAlert = document.getElementById('errorAlert');
        errorAlert.textContent = 'Error reading the CSV file';
        errorAlert.style.display = 'block';
        event.target.value = '';
    };

    reader.readAsText(file);
}

// Helper function to update analysis after grid changes
function updateAnalysis(data) {
    const analysisContent = document.getElementById('analysisContent');
    if (analysisContent.classList.contains('visible')) {
        createScoreChart(data);
        createBoxPlot(data);
        createHistogram(data);
        updateANOVA(data);
        updateSummaryStats(data);
        updateCorrelationMatrix(data);
    }
}

function enableRowRemoval() {
    currentRemovalMode = 'row';
    updateRemovalModeUI();
    const rows = document.querySelectorAll('#dataGrid .data-row');
    rows.forEach(row => row.classList.add('removal-mode'));
}

function enableColumnRemoval() {
    currentRemovalMode = 'column';
    updateRemovalModeUI();
    const headers = document.querySelectorAll('#dataGrid .header-cell');
    headers.forEach(header => header.classList.add('removal-mode'));
}

function disableRemovalMode() {
    currentRemovalMode = null;
    updateRemovalModeUI();
    // Only try to remove classes if elements exist
    const removalElements = document.querySelectorAll('#dataGrid .removal-mode');
    if (removalElements.length > 0) {
        removalElements.forEach(el => {
            el.classList.remove('removal-mode');
        });
    }
}

function updateRemovalModeUI() {
    const indicator = document.getElementById('removalModeIndicator');
    const modeText = document.getElementById('removalModeText');
    
    // Only update UI if elements exist
    if (indicator && modeText) {
        if (currentRemovalMode) {
            indicator.style.display = 'flex';
            modeText.textContent = `Click on a ${currentRemovalMode} to remove it`;
        } else {
            indicator.style.display = 'none';
        }
    }
}

// Function to download chart as PNG
function downloadChart(chartId) {
    const chart = Chart.getChart(chartId);
    if (!chart) {
        console.error('Chart not found:', chartId);
        return;
    }

    // Get the chart's canvas
    const canvas = document.getElementById(chartId);
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.download = `${chartId}-${new Date().toISOString().split('T')[0]}.png`;
    
    // Convert canvas to blob
    canvas.toBlob((blob) => {
        // Create object URL from blob
        const url = URL.createObjectURL(blob);
        
        // Set link href to object URL
        link.href = url;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 'image/png');
} 