// MongoDB initialization script
// Create database, collections and indexes

// Switch to petdb database
db = db.getSiblingDB('petdb');

// Create emotions collection (store all historical emotions + current)
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

// Create users collection (store user login information)
db.createCollection('users', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["username", "login_at"],
            properties: {
                username: {
                    bsonType: "string",
                    description: "User login username"
                },
                login_at: {
                    bsonType: "date",
                    description: "Last login timestamp"
                }
            }
        }
    }
});

// Create pets collection (store pet information with emotion states)
db.createCollection('pets', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["pet_id", "created_at", "expires_at", "is_active"],
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
                    description: "GIF URLs for different emotion states",
                    properties: {
                        happy: { bsonType: "string" },
                        sad: { bsonType: "string" },
                        excited: { bsonType: "string" },
                        calm: { bsonType: "string" },
                        neutral: { bsonType: "string" },
                        angry: { bsonType: "string" },
                        surprised: { bsonType: "string" },
                        unknown: { bsonType: "string" }
                    }
                }
            }
        }
    }
});

// Create indexes
// Emotions collection indexes
db.emotions.createIndex({ "timestamp": -1 }); // Sort by timestamp descending
db.emotions.createIndex({ "is_current": 1 }); // Query current emotion
db.emotions.createIndex({ "emotion": 1 }); // Query by emotion type

// Users collection indexes
db.users.createIndex({ "username": 1 }, { unique: true }); // Unique username
db.users.createIndex({ "login_at": -1 }); // Sort by login time

// Pets collection indexes
db.pets.createIndex({ "pet_id": 1 }, { unique: true }); // Unique pet_id
db.pets.createIndex({ "is_active": 1 }); // Query active pet
db.pets.createIndex({ "expires_at": 1 }); // Query expired pets
db.pets.createIndex({ "created_at": -1 }); // Sort by creation time

// Initialize default current emotion
db.emotions.insertOne({
    emotion: "neutral",
    timestamp: new Date(),
    is_current: true
});

// Create initial pet
var initialPet = {
    pet_id: "pet_001",
    created_at: new Date(),
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks later
    is_active: true,
    emotion_states: {
        happy: "/gifs/pet_001/happy.gif",
        sad: "/gifs/pet_001/sad.gif",
        excited: "/gifs/pet_001/excited.gif",
        calm: "/gifs/pet_001/calm.gif",
        neutral: "/gifs/pet_001/neutral.gif",
        angry: "/gifs/pet_001/angry.gif",
        surprised: "/gifs/pet_001/surprised.gif",
        unknown: "/gifs/pet_001/unknown.gif"
    }
};

db.pets.insertOne(initialPet);

print("Database initialization completed!");
print("Created collections: emotions, users, pets");
print("Created all indexes");
print("Initialized default current emotion and initial pet");

