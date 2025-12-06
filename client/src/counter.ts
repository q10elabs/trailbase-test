// Counter operations and real-time subscriptions
// Handles loading, incrementing, and subscribing to counter updates

import { client, getSubscriptionReader, setSubscriptionReader } from './state';
import { counterValue, counterError, incrementBtn, showError, hideError } from './ui';

// Counter operations
export async function loadCounter() {
  try {
    const user = client.user();
    if (!user) {
      return;
    }

    const api = client.records('counters');
    
    // Try to find existing counter for this user
    // Access rules ensure we only get our own counter, so we can list without filter
    const result = await api.list({
      pagination: { limit: 1 },
    });

    if (result.records && result.records.length > 0) {
      const counter = result.records[0] as { counter_value: number };
      counterValue.textContent = counter.counter_value.toString();
    } else {
      // Create counter if it doesn't exist
      // Explicitly pass user ID - TrailBase will validate it matches the authenticated user
      await api.create({
        user: user.id,
        counter_value: 0,
      });
      counterValue.textContent = '0';
    }
  } catch (err: any) {
    console.error('Error loading counter:', err);
    showError(counterError, err.message || 'Failed to load counter');
  }
}

export async function incrementCounter() {
  try {
    hideError(counterError);
    incrementBtn.disabled = true;

    const user = client.user();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const api = client.records('counters');
    
    // Find user's counter
    // Access rules ensure we only get our own counter, so we can list without filter
    const result = await api.list({
      pagination: { limit: 1 },
    });

    if (!result.records || result.records.length === 0) {
      // Create counter if it doesn't exist
      // Explicitly pass user ID - TrailBase will validate it matches the authenticated user
      await api.create({
        user: user.id,
        counter_value: 1,
      });
      counterValue.textContent = '1';
    } else {
      const counter = result.records[0] as { id: number; counter_value: number };
      const newValue = (counter.counter_value || 0) + 1;
      
      // Update counter
      await api.update(counter.id, {
        counter_value: newValue,
      });
      
      // Update UI immediately (realtime subscription will also update it)
      counterValue.textContent = newValue.toString();
    }
  } catch (err: any) {
    console.error('Error incrementing counter:', err);
    showError(counterError, err.message || 'Failed to increment counter');
  } finally {
    incrementBtn.disabled = false;
  }
}

export async function subscribeToCounter() {
  try {
    const user = client.user();
    if (!user) {
      return;
    }

    const api = client.records('counters');
    
    // Find user's counter ID
    // Access rules ensure we only get our own counter, so we can list without filter
    const result = await api.list({
      pagination: { limit: 1 },
    });

    if (!result.records || result.records.length === 0) {
      // No counter yet, create one
      // Explicitly pass user ID - TrailBase will validate it matches the authenticated user
      const createdId = await api.create({
        user: user.id,
        counter_value: 0,
      });
      if (createdId) {
        subscribeToCounterById(createdId as number);
      }
    } else {
      const counter = result.records[0] as { id: number };
      subscribeToCounterById(counter.id);
    }
  } catch (err) {
    console.error('Error setting up subscription:', err);
  }
}

async function subscribeToCounterById(counterId: number) {
  try {
    // Cancel existing subscription if any
    const existingReader = getSubscriptionReader();
    if (existingReader) {
      await existingReader.cancel();
    }

    const api = client.records('counters');
    const stream = await api.subscribe(counterId);
    const newReader = stream.getReader();
    setSubscriptionReader(newReader);

    // Read updates from stream
    const readLoop = async () => {
      try {
        while (true) {
          const { done, value } = await newReader.read();
          if (done) {
            console.log('Subscription ended');
            break;
          }

          // Handle update event
          const update = value as { Update?: { counter_value?: number } };
          if (update.Update?.counter_value !== undefined) {
            counterValue.textContent = update.Update.counter_value.toString();
          }
        }
      } catch (err) {
        console.error('Subscription error:', err);
        // Try to reconnect after a delay
        setTimeout(() => {
          subscribeToCounter();
        }, 5000);
      }
    };

    readLoop();
  } catch (err) {
    console.error('Error subscribing to counter:', err);
  }
}
