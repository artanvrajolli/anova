# ANOVA Score Analysis Tool

<div align="center">
  <img src="./images/fiek-logo.png" alt="FIEK Logo" width="200"/>
  <br/>
  <em>Faculty of Electrical and Computer Engineering, University of Prishtina</em>
</div>

A web-based tool for performing ANOVA (Analysis of Variance) on score data, featuring an intuitive interface for data input and comprehensive visualization of results.

## Features

- Interactive data grid for easy data entry
- Support for CSV file upload
- Real-time data analysis
- Multiple visualization options:
  - Score comparison chart
  - Box plot analysis
  - Score distribution histogram
  - Correlation matrix
- Detailed statistical analysis:
  - ANOVA results
  - Summary statistics
- Responsive design for all devices

## Live Demo

Visit the live demo at: [https://artanvrajolli.github.io/anova](https://artanvrajolli.github.io/anova)

## Usage

1. Enter your data in the grid:
   - First row: Strategy names
   - Subsequent rows: Scores for each strategy
2. Or upload a CSV file with your data
3. Click "Analyze Data" to generate results
4. View the visualizations and statistical analysis


## Development

This is a static web application built with:
- HTML5
- CSS3
- JavaScript
- Bootstrap 5
- Chart.js

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/artanvrajolli/anova.git
   ```

2. Open `index.html` in your browser or use a local server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve
   ```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Faculty of Electrical and Computer Engineering (FIEK), University of Prishtina
- Bootstrap for the UI framework
- Chart.js for the visualization components
- Bootstrap Icons for the icon set 