const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

const devCerts = process.env.HTTPS ? require("office-addin-dev-certs") : null;

module.exports = async (env, argv) => {
	const isDev = argv.mode === "development";
	const httpsOptions = isDev && process.env.HTTPS ? await devCerts.getHttpsServerOptions() : undefined;

	return {
		entry: {
			taskpane: "./src/taskpane.ts",
		},
		output: {
			path: path.resolve(__dirname, "dist"),
			filename: "[name].js",
			clean: true,
		},
		resolve: {
			extensions: [".ts", ".js"],
		},
		module: {
			rules: [
				{ test: /\.ts$/, use: "ts-loader", exclude: /node_modules/ },
				{ test: /\.css$/, use: ["style-loader", "css-loader"] },
			],
		},
		plugins: [
			new HtmlWebpackPlugin({
				template: "./src/taskpane.html",
				filename: "taskpane.html",
				chunks: ["taskpane"],
			}),
			new CopyWebpackPlugin({
				patterns: [
					{ from: "manifest.xml", to: "manifest.xml" },
					{ from: "assets", to: "assets", noErrorOnMissing: true },
				],
			}),
		],
		devServer: {
			port: 3000,
			headers: { "Access-Control-Allow-Origin": "*" },
			...(httpsOptions ? { server: { type: "https", options: httpsOptions } } : {}),
		},
	};
};
