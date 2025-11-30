// MongoDB initialization script
// Create database, collections and indexes

// Switch to petdb database
db = db.getSiblingDB('petdb');

// COLLECTION: users
// Store user login information
db.createCollection('users', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["username", "login_at"],
            properties: {
                username: {
                    bsonType: "string",
                    minLength: 3,
                    maxLength: 50,
                    description: "User login username"
                },
                login_at: {
                    bsonType: "date",
                    description: "Last login timestamp"
                },
                created_at: {
                    bsonType: "date",
                    description: "User account creation timestamp"
                },
                last_active: {
                    bsonType: "date",
                    description: "Last activity timestamp"
                },
                login_count: {
                    bsonType: "int",
                    minimum: 0,
                    description: "Total number of login sessions"
                }
            }
        }
    }
});

// COLLECTION: emotions
// Store all historical user emotions and current emotion
db.createCollection('emotions', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["emotion", "timestamp", "is_current"],
            properties: {
                emotion: {
                    bsonType: "string",
                    enum: ["happy", "sad", "excited", "calm", "neutral", "angry", "surprised", "unknown"],
                    description: "User emotion state"
                },
                timestamp: {
                    bsonType: "date",
                    description: "Timestamp when emotion was recorded"
                },
                is_current: {
                    bsonType: "bool",
                    description: "Whether this is the current emotion"
                }
            }
        }
    }
});

// COLLECTION: pets
// Store pet information with emotion state GIF URLs
// Each pet has GIF URLs for different emotion states
db.createCollection('pets', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["pet_id", "created_at", "expires_at", "is_active", "emotion_states"],
            properties: {
                pet_id: {
                    bsonType: "string",
                    description: "Unique pet identifier"
                },
                created_at: {
                    bsonType: "date",
                    description: "Pet creation timestamp"
                },
                expires_at: {
                    bsonType: "date",
                    description: "Pet expiration timestamp (2 weeks after creation)"
                },
                is_active: {
                    bsonType: "bool",
                    description: "Whether this is the current active pet"
                },
                emotion_states: {
                    bsonType: "object",
                    required: ["happy", "sad", "neutral"],
                    description: "GIF URLs for different emotion states - URLs can be passed when creating/updating pet",
                    properties: {
                        happy: {
                            bsonType: "string",
                            description: "GIF URL for happy emotion state"
                        },
                        sad: {
                            bsonType: "string",
                            description: "GIF URL for sad emotion state"
                        },
                        excited: {
                            bsonType: "string",
                            description: "GIF URL for excited emotion state"
                        },
                        calm: {
                            bsonType: "string",
                            description: "GIF URL for calm emotion state"
                        },
                        neutral: {
                            bsonType: "string",
                            description: "GIF URL for neutral emotion state"
                        },
                        angry: {
                            bsonType: "string",
                            description: "GIF URL for angry emotion state"
                        },
                        surprised: {
                            bsonType: "string",
                            description: "GIF URL for surprised emotion state"
                        },
                        unknown: {
                            bsonType: "string",
                            description: "GIF URL for unknown emotion state"
                        }
                    }
                }
            }
        }
    }
});

// INDEXES: users collection
db.users.createIndex({ "username": 1 }, { unique: true, name: "idx_users_username" });
db.users.createIndex({ "login_at": -1 }, { name: "idx_users_login_at" });
db.users.createIndex({ "last_active": -1 }, { name: "idx_users_last_active" });

// INDEXES: emotions collection
db.emotions.createIndex({ "timestamp": -1 }, { name: "idx_emotions_timestamp" });
db.emotions.createIndex({ "is_current": 1 }, { name: "idx_emotions_is_current" });
db.emotions.createIndex({ "emotion": 1 }, { name: "idx_emotions_type" });
db.emotions.createIndex({ "timestamp": -1, "emotion": 1 }, { name: "idx_emotions_timestamp_emotion" });

// INDEXES: pets collection
db.pets.createIndex({ "pet_id": 1 }, { unique: true, name: "idx_pets_pet_id" });
db.pets.createIndex({ "is_active": 1 }, { name: "idx_pets_is_active" });
db.pets.createIndex({ "expires_at": 1 }, { name: "idx_pets_expires_at" });
db.pets.createIndex({ "created_at": -1 }, { name: "idx_pets_created_at" });
db.pets.createIndex({ "is_active": 1, "expires_at": 1 }, { name: "idx_pets_active_expires" });

// INITIAL DATA: Default current emotion
db.emotions.insertOne({
    emotion: "neutral",
    timestamp: new Date(),
    is_current: true
});

// INITIAL DATA: Initial pet with GIF URLs
// Example: Create pet with GIF URLs passed as URLs
// The emotion_states object accepts URLs for each emotion state
var initialPet = {
    pet_id: "pet_001",
    created_at: new Date(),
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks later
    is_active: true,
    emotion_states: {
        happy: "https://example.com/gifs/pet_001/happy.gif",
        sad: "https://example.com/gifs/pet_001/sad.gif",
        excited: "https://example.com/gifs/pet_001/excited.gif",
        calm: "https://example.com/gifs/pet_001/calm.gif",
        neutral: "https://example.com/gifs/pet_001/neutral.gif",
        angry: "https://example.com/gifs/pet_001/angry.gif",
        surprised: "https://example.com/gifs/pet_001/surprised.gif",
        unknown: "https://example.com/gifs/pet_001/unknown.gif"
    }
};

db.pets.insertOne(initialPet);

// HELPER FUNCTION: Create pet with GIF URLs
// Example function to create a new pet by passing GIF URLs
// Usage: createPetWithUrls("pet_002", {happy: "url1", sad: "url2", ...})
var createPetWithUrls = function(petId, gifUrls) {
    var defaultUrls = {
        happy: "https://example.com/gifs/default/happy.gif",
        sad: "https://example.com/gifs/default/sad.gif",
        excited: "https://example.com/gifs/default/excited.gif",
        calm: "https://example.com/gifs/default/calm.gif",
        neutral: "https://example.com/gifs/default/neutral.gif",
        angry: "https://example.com/gifs/default/angry.gif",
        surprised: "https://example.com/gifs/default/surprised.gif",
        unknown: "https://example.com/gifs/default/unknown.gif"
    };
    
    // Merge provided URLs with defaults
    var emotionStates = Object.assign({}, defaultUrls, gifUrls);
    
    // Deactivate current pet
    db.pets.updateMany({ is_active: true }, { $set: { is_active: false } });
    
    var newPet = {
        pet_id: petId,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
        is_active: true,
        emotion_states: emotionStates
    };
    
    return db.pets.insertOne(newPet);
};

// HELPER FUNCTION: Update pet GIF URLs
// Example function to update pet emotion state GIF URLs
// Usage: updatePetUrls("pet_001", {happy: "new_url", sad: "new_url2"})
var updatePetUrls = function(petId, gifUrls) {
    var updateFields = {};
    for (var emotion in gifUrls) {
        updateFields["emotion_states." + emotion] = gifUrls[emotion];
    }
    
    return db.pets.updateOne(
        { pet_id: petId },
        { $set: updateFields }
    );
};

// HELPER FUNCTION: Get pet GIF URL for current emotion
// Get the appropriate GIF URL for the current emotion from the active pet
var getCurrentPetGifUrl = function() {
    var currentEmotion = db.emotions.findOne({ is_current: true });
    if (!currentEmotion) {
        return null;
    }
    
    var activePet = db.pets.findOne({ is_active: true });
    if (!activePet || !activePet.emotion_states) {
        return null;
    }
    
    var emotion = currentEmotion.emotion;
    return activePet.emotion_states[emotion] || activePet.emotion_states["unknown"];
};

print("Database initialization completed!");
print("Created collections: users, emotions, pets");
print("Created all indexes");
print("Initialized default current emotion and initial pet");
print("");
print("Helper functions available:");
print("  - createPetWithUrls(petId, gifUrls) - Create pet with GIF URLs");
print("  - updatePetUrls(petId, gifUrls) - Update pet GIF URLs");
print("  - getCurrentPetGifUrl() - Get current pet GIF URL based on emotion");
