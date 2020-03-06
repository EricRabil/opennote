pipeline {
  agent {
    docker {
      image 'node'
    }
  }

  stages {
    stage('Clone Sources') {
      steps {
        git 'https://github.com/EricRabil/opennote.git'
      }
    }
    stage('Information') {
      steps {
        sh 'node -v'
        sh 'npm -v'
      }
    }
    stage('Dependencies') {
      steps {
        sh 'npm install'
      }
    }
    stage('Build') {
      steps {
        sh 'npm run build'
      }
    }
    stage('Artifacts') {
      steps {
        sh 'tar -czf dist.tar.gz ./dist'
        stash 'dist.tar.gz'
      }
    }
    stage('Docker Image') {
      agent {
        docker {
          image 'nginx:alpine'
          args '-p 8081:80'
        }
      }
      steps {
        sh 'docker -v'
        unstash 'dist.tar.gz'
        sh 'tar -xzf dist.tar.gz -C /usr/share/nginx/html'
      }
    }
  }
}