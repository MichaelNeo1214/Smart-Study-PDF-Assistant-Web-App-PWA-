/**
 * Demo-ready lecture notes. They are seeded into IndexedDB on first launch so
 * judges can immediately try on-device flashcards and cloud exam guides.
 */

export interface SampleNote {
  slug: string;
  title: string;
  content: string;
}

const distributedSystems = `# Lecture 1: Distributed Systems & the CAP Theorem

## Learning objectives

By the end of this lecture you should be able to:

- Explain what makes a system *distributed* rather than merely networked.
- Describe the three properties in the CAP theorem and why partition tolerance is not optional.
- Compare CP and AP systems during a network partition.
- Use the PACELC model to reason about latency and consistency when the network is healthy.
- Recognise the consistency model that fits a given product requirement.

## 1. What is a distributed system?

A distributed system is a collection of independent computers that appears to its users as a single coherent system. The computers communicate only by passing messages over a network, and they may fail independently.

Three recurring goals:

1. **Transparency** — hide replication, sharding, and failure from the application.
2. **Scalability** — add machines to increase throughput or storage.
3. **Fault tolerance** — continue serving requests when some components fail.

A useful distinction: a *centralised* system has one source of truth; a *distributed* system has many copies of state that must be kept coherent. Every hard problem in distributed systems comes from that duplication.

## 2. Failure models and why they matter

- **Crash-stop failure**: a node halts and never returns. Easy to detect with timeouts.
- **Crash-recovery failure**: a node halts, restarts, and may lose volatile state.
- **Byzantine failure**: a node behaves arbitrarily or maliciously. Requires quorum protocols with 3f + 1 replicas to tolerate f faults.
- **Network partition**: messages between groups of nodes are delayed or dropped.

Timeouts are the only practical failure detector, but they are unreliable: a slow node looks identical to a dead node. This is why distributed algorithms avoid relying on perfect clocks and prefer logical clocks, quorums, and idempotent operations.

## 3. The CAP theorem

Eric Brewer formulated CAP in 2000 and Seth Gilbert and Nancy Lynch proved it in 2002. The theorem states that a distributed data store cannot simultaneously guarantee all three of:

- **Consistency (C)**: every read observes the most recent successful write, or returns an error. This is stronger than the everyday meaning of consistency; it usually means linearizability.
- **Availability (A)**: every request to a non-failing node receives a non-error response within a bounded time.
- **Partition tolerance (P)**: the system keeps operating when arbitrary messages between nodes are lost or delayed.

The crucial insight: **P is not a design choice**. Real networks partition. During a partition you must choose between C and A:

- **CP system**: reject reads or writes that cannot reach a quorum. Example: a bank ledger that refuses a transfer instead of risking a double spend.
- **AP system**: keep serving reads and writes, then reconcile conflicting versions later. Example: a social feed that accepts a post on both sides of a partition.

Outside a partition, a system can provide both consistency and availability; CAP says nothing about that case. This is the most common exam trap.

## 4. The consistency spectrum

Strong consistency is expensive. Most systems pick a point on a spectrum:

| Model | Guarantee | Typical use |
|---|---|---|
| Linearizable | Reads see the latest completed write, with a real-time order | Leader election, distributed locks |
| Sequential | All nodes see operations in the same order, not necessarily real time | Shared logs |
| Causal | Operations related by happens-before are seen in order | Collaborative editing |
| Read-your-writes | A client sees its own writes | User profiles |
| Eventual | Replicas converge given no new writes | DNS, metrics, feeds |

Eventual consistency is not "no consistency"; it is a liveness promise that replicas converge. The engineering question is how long convergence takes and what users observe in the meantime.

## 5. PACELC: the rest of the story

CAP only describes behaviour during a partition. PACELC extends it:

> If there is a **P**artition, choose **A** or **C**; **E**lse (normal operation), choose **L**atency or **C**onsistency.

A globally replicated database that waits for a cross-region quorum on every write is PC/EC. A local-first app that writes to a local cache and syncs in the background is PA/EL. Most mobile and collaborative products are PA/EL because users value instant feedback more than global linearizability.

## 6. Worked examples

- **Bank transfer**: needs linearizable balances and idempotency keys. Choose CP during partitions and reject rather than duplicate money.
- **Social feed**: accepts posts from any region and merges them later. Choose AP; users tolerate stale counts for a few seconds.
- **Coordination service (etcd, ZooKeeper)**: implements leases and leader election with quorum reads and writes. Choose CP.
- **Shopping cart**: can merge two carts after a partition, so AP is acceptable if the merge rule is deterministic.

## 7. Replication and quorums

With N replicas, a write quorum W and a read quorum R give strong read-your-writes when **R + W > N**. For example, N = 3, W = 2, R = 2. Quorum intersection guarantees that every read set overlaps the most recent write set.

Trade-offs:

- Larger W improves durability but increases write latency.
- Larger R improves freshness but increases read latency.
- R + W <= N allows stale reads but can improve availability during partitions.

## 8. Common exam traps

1. "CAP means you can pick any two of three." Only P is forced; C and A are traded only during a partition.
2. "Eventual consistency means data is lost." It means replicas converge; conflicts still need a resolution rule.
3. "A timeout proves a node is dead." It only proves the response was not observed in time.
4. "Two-phase commit is partition tolerant." It blocks when the coordinator fails; it is not available under partition.
5. "More replicas always means more consistency." Without quorum intersection, more replicas can increase divergence.

## 9. Quick self-check

- Why can a CP system still be available when the network is healthy?
- What does R + W > N guarantee, and what does it not guarantee?
- Give one product where stale reads are acceptable and one where they are not.
- Explain PACELC in one sentence without using the word "CAP".

## 10. Key takeaways

- Distribution turns every operation into a coordination problem.
- Partitions are inevitable; choose CP or AP deliberately.
- Consistency is a spectrum, not a binary.
- Latency is a first-class correctness concern for interactive products.
- Document the conflict-resolution rule before shipping an AP system.`;

const neuralNetworks = `# Lecture 2: Neural Networks & Backpropagation

## Learning objectives

- Build a multilayer perceptron from affine transforms and non-linear activations.
- Compute a forward pass and a backward pass for a small network by hand.
- Explain why backpropagation is the chain rule plus dynamic programming.
- Choose an appropriate loss function and output activation.
- Diagnose vanishing gradients, exploding gradients, and overfitting.

## 1. From the perceptron to a multilayer network

A single perceptron computes a weighted sum followed by a threshold:

z = w · x + b, then y = step(z).

A single layer can only separate linearly separable data. Stacking layers with non-linear activations lets the network approximate complex functions. A layer computes:

z = W x + b
a = σ(z)

where W is a weight matrix, b is a bias vector, and σ is applied element-wise. The Universal Approximation Theorem says a sufficiently wide one-hidden-layer network can approximate any continuous function on a compact domain, but it says nothing about how many samples or how much compute is needed.

## 2. Activation functions

- **Sigmoid**: σ(z) = 1 / (1 + e^(-z)). Output in (0, 1). Saturates for large |z| and has a maximum derivative of 0.25, which contributes to vanishing gradients.
- **Tanh**: zero-centred, output in (-1, 1). Usually trains better than sigmoid in hidden layers, but still saturates.
- **ReLU**: max(0, z). Cheap, does not saturate for positive z, but can produce dead units when z stays negative.
- **Leaky ReLU**: max(αz, z) with a small α such as 0.01. Keeps a gradient for negative inputs.
- **Softmax**: converts a vector of logits into a probability distribution. Used for mutually exclusive classes.

The output activation should match the task: sigmoid for binary classification, softmax for multiclass, identity for regression.

## 3. Loss functions

**Mean squared error** for regression:

L = (1/n) Σ (y_i - ŷ_i)^2

**Binary cross-entropy** for binary classification:

L = -(1/n) Σ [y_i log(ŷ_i) + (1 - y_i) log(1 - ŷ_i)]

**Categorical cross-entropy** for multiclass:

L = -(1/n) Σ Σ y_ic log(ŷ_ic)

Cross-entropy punishes confident wrong predictions much more strongly than MSE. With a sigmoid or softmax output, its gradient with respect to the logits simplifies to (ŷ - y), which is numerically stable and easy to implement.

## 4. The forward pass

For a two-layer network:

z1 = W1 x + b1
a1 = ReLU(z1)
z2 = W2 a1 + b2
ŷ = softmax(z2)

Keep every intermediate value (x, z1, a1, z2) during the forward pass. Backpropagation reuses them, which is why training memory grows with network depth and batch size.

## 5. Backpropagation = chain rule + dynamic programming

Backpropagation computes the gradient of the loss with respect to every parameter efficiently. For a scalar loss L and a pre-activation z, define the error signal:

δ = ∂L / ∂z

For the output layer with softmax and cross-entropy, δ2 = ŷ - y. Then:

∂L/∂W2 = δ2 a1ᵀ
∂L/∂b2 = δ2
δ1 = (W2ᵀ δ2) ⊙ σ'(z1)
∂L/∂W1 = δ1 xᵀ
∂L/∂b1 = δ1

The ⊙ symbol is the element-wise product. The key idea is that δ for an earlier layer is computed from δ of the later layer, so each gradient is computed once. Naively applying the chain rule separately for every parameter would recompute shared sub-expressions exponentially often.

## 6. Gradient descent variants

- **Batch gradient descent**: uses the full dataset. Stable but slow and memory heavy.
- **Stochastic gradient descent (SGD)**: uses one sample. Noisy but cheap.
- **Mini-batch SGD**: the practical default; balances noise and hardware utilisation.
- **Momentum**: accumulates a velocity term, damping oscillation in ravines.
- **Adam**: combines momentum with per-parameter adaptive scaling using estimates of the first and second moments. A common default with learning rate around 1e-3.

Update rule for plain SGD with learning rate η:

W ← W - η (∂L/∂W)

## 7. Vanishing and exploding gradients

In a deep network, the gradient is a product of many Jacobians. If their norms are consistently below 1, the signal shrinks exponentially (vanishing). If above 1, it grows exponentially (exploding).

Mitigations:

- ReLU-family activations instead of sigmoid in hidden layers.
- Careful weight initialisation: Xavier/Glorot for tanh, He for ReLU.
- Batch normalisation or layer normalisation.
- Residual connections, which give gradients a short path to earlier layers.
- Gradient clipping, especially for recurrent networks.
- Gated architectures such as LSTM and GRU for sequences.

## 8. Overfitting and regularisation

A model overfits when training loss keeps falling while validation loss rises. Tools:

- More data or data augmentation.
- Weight decay (L2 regularisation): add λ||W||² to the loss.
- Dropout: randomly zero activations during training, rescale at inference.
- Early stopping on validation loss.
- Smaller models or architectural constraints.

Always evaluate on a held-out validation set. A low training loss is not evidence of generalisation.

## 9. Worked numeric example

Consider one input x = 1, one weight w = 2, no bias, a linear output ŷ = wx = 2, and target y = 5 with MSE loss.

L = (ŷ - y)² = 9
∂L/∂ŷ = 2(ŷ - y) = -6
∂ŷ/∂w = x = 1
∂L/∂w = -6

With learning rate η = 0.1, the update is w ← 2 - 0.1(-6) = 2.6. The next prediction is 2.6, closer to the target. Repeating this process is gradient descent.

## 10. Common exam traps

1. "Backpropagation is a learning algorithm." It is a gradient algorithm; the optimiser performs the update.
2. "More layers always improve accuracy." Depth increases capacity but also optimisation difficulty and overfitting risk.
3. "Softmax is needed for every multiclass problem." It is needed when classes are mutually exclusive and you want probabilities.
4. "Zero loss on training data means success." It may simply mean memorisation.
5. "ReLU is differentiable everywhere." It is not differentiable at zero; frameworks use a subgradient such as 0 or 1.

## 11. Key takeaways

- A neural network is a composition of affine maps and non-linearities.
- The loss defines the learning signal; the output activation must match the task.
- Backpropagation is reverse-mode automatic differentiation over the computation graph.
- Initialisation, normalisation, and residual paths control gradient flow.
- Generalisation, not training loss, is the goal.`;

export const SAMPLE_NOTES: SampleNote[] = [
  { slug: "distributed-systems-cap", title: "Lecture 1: Distributed Systems & CAP Theorem", content: distributedSystems },
  { slug: "neural-networks-backpropagation", title: "Lecture 2: Neural Networks & Backpropagation", content: neuralNetworks },
];
