#define BODY_COUNT 5
#define PAIR_COUNT 10
#define PI 3.14159265358979323846

static const float PHASE = PI;
static const float SOFTEN = PI;

struct Body4 { float4 position; float4 velocity; float mass; };
struct FracRes4 { int step; float accum; };
struct ParticleConfig { float masses[BODY_COUNT]; float density; };


static const float4 VERTICES4[BODY_COUNT] =
{
    float4(0.500000000000, -0.288675100000, -0.204124200000, -0.158113900000), 
    float4(-0.000000004832, 0.577350300000, -0.204124100000, -0.158113900000),  
    float4(-0.000000004832, -0.000000003354, 0.612372500000, -0.158113900000),  
    float4(-0.000000004832, -0.000000003354, -0.000000005714, 0.632455500000), 
    float4(-0.500000000000, -0.288675100000, -0.204124200000, -0.158113900000 ),
};

// Unique index pairs (i < j)
static const int2 PAIRS[PAIR_COUNT] = {
    int2(0,1), int2(0,2), int2(0,3), int2(0,4),
    int2(1,2), int2(1,3), int2(1,4), 
    int2(2,3), int2(2,4), 
    int2(3,4)
};

inline void computeAccelerations(in Body4 b[BODY_COUNT], out float4 a[BODY_COUNT])
{
    [unroll] for (int i=0;i<BODY_COUNT;++i) a[i] = float4(0,0,0,0);
    
    [unroll]
    for (int pi=0; pi<PAIR_COUNT; ++pi)
    {
        int i = PAIRS[pi].x, j = PAIRS[pi].y;
        float4 r = b[j].position - b[i].position;
        
        float r2 = dot(r, r) + SOFTEN;
        float inv  = rsqrt(r2);
        float inv3 = inv * inv * inv;

        float4 aij = b[j].mass * r * inv3;
        float4 aji = b[i].mass * (-r) * inv3;
        
        a[i] += aij;
        a[j] += aji;
    }
}

float EvaluateFractal(
    int steps,
    float4 position,
    float4 coreVelocity,
    float escapeR2,
    ParticleConfig cfg
)
{
    Body4 b[BODY_COUNT];

    [unroll]
    for (int i=0;i<BODY_COUNT;++i)
    { 
        b[i].position = cfg.density / (exp(length(position - VERTICES4[i]))); 
        b[i].velocity = float4(0,0,0,0);
        b[i].mass = cfg.masses[i]; 
    }
    
    b[0].velocity = coreVelocity;
    
    float4 a0[BODY_COUNT];
    computeAccelerations(b, a0);

    static float dt = PHASE;
    static float dt2 = dt*dt;

    bool alive = true;
    float accum = 0.0;
    
    for (int s=0; s<=steps; ++s)
    {
        if (alive)
        {
            [unroll]
            for (int i=0;i<BODY_COUNT;++i)
            {
                b[i].position += b[i].velocity * dt + 0.5 * a0[i] * dt2;
            }
            
            float4 a1[BODY_COUNT];
            computeAccelerations(b, a1);
            
            [unroll]
            for (int i=0;i<BODY_COUNT;++i)
            {
                b[i].velocity += 0.5 * (a0[i] + a1[i]) * dt;
            }
            
            [unroll]
            for (int i=0;i<BODY_COUNT;++i)
            {
                a0[i] = a1[i];
            }
            
            float maxR2 = 0.0;
            
            [unroll]
            for (int i = 0; i < BODY_COUNT; ++i)
            {
                accum += dot(b[i].velocity, b[i].velocity);
                maxR2 = max(maxR2, dot(b[i].position, b[i].position));
            }
           
            if (maxR2 > escapeR2)
            {
                alive = false;
            }
        }
    }

    return accum;
}