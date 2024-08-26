import tensorflow as tf
from tensorflow import keras
import numpy as np
import json
import tensorflowjs as tfjs

# Define the feature extraction function (similar to the JavaScript version)
def extract_features(element):
    return [
        element['width'],
        element['height'],
        1 if element['tagName'] == 'IMG' else 0,
        1 if element['tagName'] == 'IFRAME' else 0,
        1 if 'ad' in element['id'].lower() else 0,
        1 if 'ad' in element['className'].lower() else 0,
        # Add more features as needed
    ]

# Load and preprocess the dataset
def load_dataset(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    X = np.array([extract_features(element) for element in data])
    y = np.array([element['isAd'] for element in data])
    
    return X, y

# Define the model architecture
def create_model(input_shape):
    model = keras.Sequential([
        keras.layers.Dense(64, activation='relu', input_shape=(input_shape,)),
        keras.layers.Dense(32, activation='relu'),
        keras.layers.Dense(16, activation='relu'),
        keras.layers.Dense(1, activation='sigmoid')
    ])
    return model

# Train the model
def train_model(X_train, y_train, X_val, y_val, epochs=10, batch_size=32):
    model = create_model(X_train.shape[1])
    model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
    
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=epochs,
        batch_size=batch_size
    )
    
    return model, history

# Evaluate the model
def evaluate_model(model, X_test, y_test):
    loss, accuracy = model.evaluate(X_test, y_test)
    print(f"Test accuracy: {accuracy:.4f}")
    return loss, accuracy

# Save the model in TensorFlow.js format
def save_model_for_tfjs(model, output_dir):
    tfjs.converters.save_keras_model(model, output_dir)
    print(f"Model saved in TensorFlow.js format at {output_dir}")

if __name__ == "__main__":
    # Load and split the dataset
    X, y = load_dataset('ad_dataset.json')
    train_split = 0.7
    val_split = 0.15
    test_split = 0.15
    
    split_1 = int(len(X) * train_split)
    split_2 = int(len(X) * (train_split + val_split))
    
    X_train, y_train = X[:split_1], y[:split_1]
    X_val, y_val = X[split_1:split_2], y[split_1:split_2]
    X_test, y_test = X[split_2:], y[split_2:]
    
    # Train the model
    model, history = train_model(X_train, y_train, X_val, y_val)
    
    # Evaluate the model
    evaluate_model(model, X_test, y_test)
    
    # Save the model for TensorFlow.js
    save_model_for_tfjs(model, 'ad_detection_model')