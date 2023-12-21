const { connection } = require("./database");
const tf = require("@tensorflow/tfjs");
const os = require("os");
const path = require("path");
require("dotenv").config();
const { promisify } = require("util");
const fs = require("fs");
const readFileAsync = promisify(fs.readFile);

let model;

async function loadModel() {
  try {
    console.log("Loading model...");
    const modelPath = path.join(__dirname, "model/model.json");
    const weighPath = path.join(__dirname, "model/group1-shard1of1.bin");
    const modelData = await readFileAsync(modelPath);
    const weightData = await readFileAsync(weighPath);
    console.log(modelData);
    console.log("Model data loaded successfully.");
    model = await tf.loadLayersModel(
      tf.io.fromMemory({
        modelTopology: modelData,
        weightData: weightData,
      })
    );

    console.log("Model loaded successfully");
  } catch (error) {
    console.error("Error loading model:", error);
  }
}

async function getRecommendations(userId) {
  try {
    // Load model if not loaded
    if (!model) {
      await loadModel();
    }

    // Retrieve user's rated products from the database
    const result = await connection.query(
      "SELECT product_id, rate FROM review WHERE user_id = ?",
      [userId]
    );

    const userRatings = result[0] || [];

    if (userRatings.length === 0) {
      return { error: "User has no review" };
    }

    // Extract product IDs and ratings
    const productIds = userRatings.map(({ product_id }) => product_id);
    const userRatingsTensor = tf.tensor2d(
      userRatings.map(({ rating }) => rating),
      [1, userRatings.length]
    );

    // Predict ratings for all products
    const allProductsResult = await connection.query(
      "SELECT product_id FROM products"
    );
    const allProductIds = (allProductsResult[0] || []).map(({ id }) => id); // Gunakan array kosong jika allProductsResult[0] adalah undefined

    if (allProductIds.length === 0) {
      return { error: "No products in the database." };
    }

    const unratedProducts = allProductIds.filter(
      (productId) => !productIds.includes(productId)
    );

    const unratedProductsTensor = tf.tensor2d(
      Array(unratedProducts.length).fill(0), // Placeholder for unrated products
      [1, unratedProducts.length]
    );

    const predictionsTensor = model.predict(
      tf.concat([userRatingsTensor, unratedProductsTensor], 1)
    );
    const predictions = predictionsTensor.arraySync()[0];

    // Sort predicted ratings and get top recommendations
    const topRecommendations = unratedProducts
      .map((productId, index) => ({
        productId,
        prediction: predictions[index],
      }))
      .sort((a, b) => b.prediction - a.prediction)
      .slice(0, 5); // Adjust the number of recommendations as needed

    // Save recommendations to the database (optional)
    await saveRecommendationsToDatabase(userId, topRecommendations);

    return { recommendations: topRecommendations };
  } catch (error) {
    console.error("Error getting recommendations:", error);
    return { error: "Internal Server Error" };
  }
}

async function saveRecommendationsToDatabase(userId, recommendations) {
  // Save recommendations to the database (sample implementation)
  const values = recommendations
    .map(
      ({ productId, prediction }) => `(${userId}, ${productId}, ${prediction})`
    )
    .join(",");

  await connection.execute(`
    INSERT INTO recommended_products (user_id, product_id, prediction)
    VALUES ${values}
    ON DUPLICATE KEY UPDATE prediction = VALUES(prediction);
  `);

  console.log("Recommendations saved to the database");
}

function setupRoutes(app) {
  // Endpoint untuk mendapatkan rekomendasi berdasarkan peringkat
  app.get("/recommendations/:user_id", async (req, res) => {
    const userId = req.params.user_id;

    // Get recommendations
    const result = await getRecommendations(userId);
    res.json(result);
  });
}

// Endpoint lainnya untuk CRUD operasi
// ...

module.exports = { setupRoutes };
