const path = require('path');
const webpack = require('webpack');
const DashboardPlugin = require('webpack-dashboard/plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const prefix = path.resolve(__dirname);
const nodeEnv = process.env.NODE_ENV;

const isProduction = nodeEnv === 'production';

console.log(`MODE: ${nodeEnv}`); // eslint-disable-line no-console

const config = {
  entry: `${prefix}/src/app.js`,
  output: {
    path: `${prefix}/dist`,
    publicPath: '/sector17/',
    filename: 'app.js'
  },
  module: {
    rules: [{
      test: /\.js$/,
      exclude: /(node_modules)/,
      use: 'babel-loader'
    }, {
      test: /\.css$/,
      use: [
        'style-loader',
        'css-loader?importLoader=1&modules&localIdentName=[path]_[local]_[hash:base64:7]'
      ]
    }, {
      test: /\.(ttf|eot|svg|woff|woff2)$/,
      use: 'url?limit=10000'
    } ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(nodeEnv)
      }
    }),
    new HtmlWebpackPlugin()
  ]
};

if (!isProduction) {
  config.plugins.push(new DashboardPlugin());
}

module.exports = config;
