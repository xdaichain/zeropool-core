set -ex

cd circom
if [ ! -d "./circuitsCompiled" ]; then
    echo "Compiling cicuits"
    npm ci
    ./setup.sh
fi
cd ..

cd lib
npm ci
npm run build
cd ..
