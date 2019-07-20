import React, { Component } from 'react';
import { BrowserRouter as Router, Route, Link } from 'react-router-dom';
import './App.css';

class Subreddit extends Component {
  constructor(props) {
    super(props);
    this.state = {posts: [], error: false};
  }

  componentDidMount() {
    fetch(`http://localhost:8000/r/${this.props.match.params.name}/`)
      .then(response => {
        if (response.status !== 200) {
          return this.setState({error: true});
        }
        return response.json();
      })
      .then(data => this.setState({posts: data.posts}));
  }
  
  render() {
    let posts;
    if (this.state.error) {
      posts = <p>There was an error rendering posts</p>;
    } else if (this.state.posts.length === 0) {
      posts = <p>No posts to show</p>;
    } else {
      posts = this.state.posts.map((post, idx) => {
        return (
          <Post
            title={post.title}
            subreddit={post.subreddit}
            score={post.score}
            numComments={post.numComments}
            key={idx}
          />
        );
      });
    }
    return (
      <div>
        <h1>/r/{this.props.match.params.name}</h1>
        <h2>Posts:</h2>
        <div>
          {posts}
        </div>
      </div>
    );
  }
}

class Post extends Component {
  render() {
    return (
      <div>
        <h2>{this.props.title}</h2>
        <p><Link to={`/r/${this.props.subreddit}`}>/r/{this.props.subreddit}</Link></p>
        <p>{this.props.numComments} Comment{this.props.numComments === 1 ? '' : 's'}</p>
        <p>Score: {this.props.score}</p>
      </div>
    );
  }
}

class Home extends Component {
  constructor(props) {
    super(props);
    this.state = {
      posts: [],
      user: undefined,
    };
  }

  componentDidMount() {
    fetch('http://localhost:8000/posts/')
      .then(response => {
        if (response.status !== 200) {
          return console.warn('Uh oh');
        }
        return response.json();
      })
      .then(data => this.setState({posts: data.posts}));
  }
  
  render() {
    return (
      <div>
        <h1>Reddit Clone</h1>
        <p>{this.state.user ? `Logged in as ${this.state.user}` : `Not logged in`}</p>
        {this.state.posts.map((post, idx) => {
          return (
            <Post
              title={post.title}
              subreddit={post.subreddit}
              score={post.score}
              numComments={post.numComments}
              key={idx}
            />
          );
        })}
      </div>
    );
  }
}

class App extends Component {
  render() {
    return (
      <Router>
        <nav>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
          </ul>
        </nav>
        <Route exact path="/" component={Home} />
        <Route path="/r/:name" component={Subreddit} />
      </Router>
    );
  }
}

export default App;
