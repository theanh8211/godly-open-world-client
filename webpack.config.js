const path = require('path');

module.exports = {
    entry: './client/scripts/game.js', // Entry point chính xác
    output: {
        path: path.resolve(__dirname, 'client/dist'), // Đầu ra tại /client/dist
        filename: 'bundle.js'
    },
    mode: 'development', // Thêm mode để tránh warning
    resolve: {
        extensions: ['.js'], // Đảm bảo Webpack nhận diện file .js
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader', // Để hỗ trợ ES modules
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ]
    }
};