// Example JavaScript file
function calculateSum(numbers) {
  return numbers.reduce((sum, num) => sum + num, 0);
}

function processData(data) {
  return data.filter(item => item > 0).map(item => item * 2);
}

module.exports = { calculateSum, processData };
