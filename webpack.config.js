const path = require('path');

module.exports = {
  entry: './src/content_script.js',
  output: {
    filename: 'content_script.js',
    path: path.resolve(__dirname, ''),
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    fallback: {
      "crypto": false,
      "stream": false
    }
  }
}; 